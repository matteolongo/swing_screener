"""Service layer for dedicated intelligence config and symbol sets."""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
import uuid

from fastapi import HTTPException

from api.models.intelligence_config import (
    IntelligenceConfigModel,
    IntelligenceConfigStorageEnvelope,
    IntelligenceProviderInfoResponse,
    IntelligenceProviderTestRequest,
    IntelligenceProviderTestResponse,
    IntelligenceSymbolSetCreateRequest,
    IntelligenceSymbolSetResponse,
    IntelligenceSymbolSetUpdateRequest,
)
from api.repositories.intelligence_config_repo import IntelligenceConfigRepository
from api.repositories.intelligence_symbol_sets_repo import IntelligenceSymbolSetsRepository
from api.repositories.strategy_repo import StrategyRepository
from swing_screener.intelligence.config import SUPPORTED_INTEL_PROVIDERS, build_intelligence_config
from swing_screener.intelligence.llm.factory import build_llm_provider


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


def _to_jsonable(value):
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_jsonable(item) for key, item in value.items()}
    return value


class IntelligenceConfigService:
    def __init__(
        self,
        *,
        strategy_repo: StrategyRepository,
        config_repo: IntelligenceConfigRepository | None = None,
        symbol_sets_repo: IntelligenceSymbolSetsRepository | None = None,
    ) -> None:
        self._strategy_repo = strategy_repo
        self._config_repo = config_repo or IntelligenceConfigRepository()
        self._symbol_sets_repo = symbol_sets_repo or IntelligenceSymbolSetsRepository()

    def _normalize_config_payload(self, raw_payload: dict) -> IntelligenceConfigModel:
        normalized = build_intelligence_config({"market_intelligence": raw_payload})
        as_payload = _to_jsonable(asdict(normalized))
        return IntelligenceConfigModel.model_validate(as_payload)

    def _default_config(self) -> IntelligenceConfigModel:
        return self._normalize_config_payload({})

    def _bootstrap_from_strategy_payload(self) -> IntelligenceConfigModel:
        strategy = self._strategy_repo.get_active_strategy()
        market_intelligence = strategy.get("market_intelligence") if isinstance(strategy, dict) else None
        if not isinstance(market_intelligence, dict):
            market_intelligence = {}
        return self._normalize_config_payload(market_intelligence)

    def get_config(self) -> IntelligenceConfigModel:
        raw = self._config_repo.load_raw()
        if isinstance(raw, dict):
            try:
                envelope = IntelligenceConfigStorageEnvelope.model_validate(raw)
                return envelope.config
            except Exception:
                pass

        config = self._bootstrap_from_strategy_payload()
        envelope = IntelligenceConfigStorageEnvelope(
            config=config,
            bootstrapped_from_strategy=True,
            updated_at=_now_iso(),
        )
        self._config_repo.save_raw(envelope.model_dump())
        return config

    def update_config(self, payload: IntelligenceConfigModel) -> IntelligenceConfigModel:
        config = self._normalize_config_payload(payload.model_dump())
        envelope = IntelligenceConfigStorageEnvelope(
            config=config,
            bootstrapped_from_strategy=False,
            updated_at=_now_iso(),
        )
        self._config_repo.save_raw(envelope.model_dump())
        return config

    def list_providers(self) -> list[IntelligenceProviderInfoResponse]:
        config = self.get_config()
        out: list[IntelligenceProviderInfoResponse] = []
        for provider_name in sorted({"mock", "ollama", "openai"}):
            model = config.llm.model
            base_url = config.llm.base_url
            api_key = config.llm.api_key
            if provider_name == "openai" and config.llm.provider != "openai":
                model = "gpt-4o-mini"
                base_url = "https://api.openai.com/v1"
            if provider_name == "ollama" and config.llm.provider != "ollama":
                model = "mistral:7b-instruct"
                base_url = "http://localhost:11434"
            if provider_name == "mock":
                base_url = None
            detail: str | None = None
            try:
                provider = build_llm_provider(
                    provider_name=provider_name,
                    model=model,
                    base_url=base_url,
                    api_key=api_key,
                )
                available = provider.is_available()
                if not available:
                    detail = "Provider is configured but unavailable."
            except Exception as exc:
                available = False
                detail = str(exc)
            out.append(
                IntelligenceProviderInfoResponse(
                    provider=provider_name,
                    available=available,
                    detail=detail,
                )
            )
        return out

    def test_provider(self, request: IntelligenceProviderTestRequest) -> IntelligenceProviderTestResponse:
        try:
            provider = build_llm_provider(
                provider_name=request.provider,
                model=request.model,
                base_url=request.base_url,
                api_key=request.api_key,
            )
            available = provider.is_available()
            detail = None if available else "Provider initialized but model/service is unavailable."
            return IntelligenceProviderTestResponse(
                provider=request.provider,
                model=request.model,
                available=available,
                detail=detail,
            )
        except Exception as exc:
            return IntelligenceProviderTestResponse(
                provider=request.provider,
                model=request.model,
                available=False,
                detail=str(exc),
            )

    def list_symbol_sets(self) -> list[IntelligenceSymbolSetResponse]:
        raw_items = self._symbol_sets_repo.list_sets()
        parsed: list[IntelligenceSymbolSetResponse] = []
        for raw in raw_items:
            try:
                parsed.append(IntelligenceSymbolSetResponse.model_validate(raw))
            except Exception:
                continue
        parsed.sort(key=lambda item: item.updated_at, reverse=True)
        return parsed

    def _normalize_symbols(self, symbols: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for symbol in symbols:
            text = str(symbol).strip().upper()
            if not text or text in seen:
                continue
            seen.add(text)
            normalized.append(text)
        return normalized

    def create_symbol_set(self, request: IntelligenceSymbolSetCreateRequest) -> IntelligenceSymbolSetResponse:
        now = _now_iso()
        payload = IntelligenceSymbolSetResponse(
            id=uuid.uuid4().hex,
            name=request.name.strip(),
            symbols=self._normalize_symbols(request.symbols),
            created_at=now,
            updated_at=now,
        )
        self._symbol_sets_repo.upsert_set(payload.model_dump())
        return payload

    def update_symbol_set(
        self,
        symbol_set_id: str,
        request: IntelligenceSymbolSetUpdateRequest,
    ) -> IntelligenceSymbolSetResponse:
        existing = self._symbol_sets_repo.get_set(symbol_set_id)
        if existing is None:
            raise HTTPException(status_code=404, detail=f"Symbol set not found: {symbol_set_id}")
        created_at = str(existing.get("created_at") or _now_iso())
        payload = IntelligenceSymbolSetResponse(
            id=symbol_set_id,
            name=request.name.strip(),
            symbols=self._normalize_symbols(request.symbols),
            created_at=created_at,
            updated_at=_now_iso(),
        )
        self._symbol_sets_repo.upsert_set(payload.model_dump())
        return payload

    def delete_symbol_set(self, symbol_set_id: str) -> bool:
        return self._symbol_sets_repo.delete_set(symbol_set_id)

    def resolve_symbol_scope(
        self,
        *,
        symbols: list[str] | None,
        symbol_set_id: str | None,
    ) -> list[str]:
        if symbols:
            normalized = self._normalize_symbols(symbols)
            if normalized:
                return normalized
        if symbol_set_id:
            raw = self._symbol_sets_repo.get_set(symbol_set_id)
            if raw is None:
                raise HTTPException(status_code=404, detail=f"Symbol set not found: {symbol_set_id}")
            parsed = IntelligenceSymbolSetResponse.model_validate(raw)
            normalized = self._normalize_symbols(parsed.symbols)
            if not normalized:
                raise HTTPException(status_code=400, detail="Symbol set has no valid symbols.")
            return normalized
        raise HTTPException(status_code=400, detail="Provide either symbols or symbol_set_id.")

    @staticmethod
    def allowed_event_providers() -> list[str]:
        return sorted(SUPPORTED_INTEL_PROVIDERS)
