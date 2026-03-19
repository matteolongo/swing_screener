"""Fundamentals service."""
from __future__ import annotations

from api.models.fundamentals import (
    FundamentalRefreshRequest,
    FundamentalSnapshotResponse,
    FundamentalsCompareRequest,
    FundamentalsCompareResponse,
    FundamentalsConfigModel,
)
from api.repositories.fundamentals_config_repo import FundamentalsConfigRepository
from swing_screener.fundamentals import FundamentalsAnalysisService, build_fundamentals_config


class FundamentalsService:
    def __init__(
        self,
        *,
        config_repo: FundamentalsConfigRepository | None = None,
        analysis_service: FundamentalsAnalysisService | None = None,
    ) -> None:
        self._config_repo = config_repo or FundamentalsConfigRepository()
        self._analysis_service = analysis_service or FundamentalsAnalysisService()

    def _normalize_config(self, raw_payload: dict | None = None) -> FundamentalsConfigModel:
        cfg = build_fundamentals_config(raw_payload or {})
        return FundamentalsConfigModel.model_validate(
            {
                "enabled": cfg.enabled,
                "providers": list(cfg.providers),
                "cache_ttl_hours": cfg.cache_ttl_hours,
                "stale_after_days": cfg.stale_after_days,
                "compare_limit": cfg.compare_limit,
            }
        )

    def get_config(self) -> FundamentalsConfigModel:
        return self._normalize_config(self._config_repo.load_raw())

    def update_config(self, payload: FundamentalsConfigModel) -> FundamentalsConfigModel:
        normalized = self._normalize_config(payload.model_dump())
        self._config_repo.save_raw(normalized.model_dump())
        return normalized

    def get_snapshot(self, symbol: str, *, force_refresh: bool = False) -> FundamentalSnapshotResponse:
        cfg = build_fundamentals_config(self.get_config().model_dump())
        if not cfg.enabled:
            raise ValueError("Fundamentals feature is disabled. Enable it in configuration first.")
        snapshot = self._analysis_service.get_snapshot(symbol, cfg=cfg, force_refresh=force_refresh)
        return FundamentalSnapshotResponse.model_validate(snapshot.to_dict())

    def refresh_snapshot(self, request: FundamentalRefreshRequest) -> FundamentalSnapshotResponse:
        return self.get_snapshot(request.symbol, force_refresh=True)

    def compare(self, request: FundamentalsCompareRequest) -> FundamentalsCompareResponse:
        cfg = build_fundamentals_config(self.get_config().model_dump())
        if not cfg.enabled:
            raise ValueError("Fundamentals feature is disabled. Enable it in configuration first.")
        snapshots = self._analysis_service.compare_symbols(
            request.symbols,
            cfg=cfg,
            force_refresh=request.force_refresh,
        )
        return FundamentalsCompareResponse(
            snapshots=[FundamentalSnapshotResponse.model_validate(snapshot.to_dict()) for snapshot in snapshots]
        )
