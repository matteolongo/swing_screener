from __future__ import annotations

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import TRUST_METADATA_MISSING_FLAG, FundamentalSnapshot
from swing_screener.fundamentals.providers import (
    DegiroFundamentalsProvider,
    SecEdgarFundamentalsProvider,
    YfinanceFundamentalsProvider,
)
from swing_screener.fundamentals.scoring import build_provider_error_snapshot, build_snapshot
from swing_screener.fundamentals.storage import FundamentalsStorage


def _normalize_symbol(symbol: str) -> str:
    cleaned = str(symbol).strip().upper()
    if not cleaned:
        raise ValueError("symbol is required")
    return cleaned


class FundamentalsAnalysisService:
    def __init__(
        self,
        *,
        storage: FundamentalsStorage | None = None,
        sec_edgar_provider: SecEdgarFundamentalsProvider | None = None,
        yfinance_provider: YfinanceFundamentalsProvider | None = None,
        degiro_provider: DegiroFundamentalsProvider | None = None,
    ) -> None:
        self._storage = storage or FundamentalsStorage()
        self._sec_edgar_provider = sec_edgar_provider or SecEdgarFundamentalsProvider()
        self._yfinance_provider = yfinance_provider or YfinanceFundamentalsProvider()
        self._degiro_provider = degiro_provider or DegiroFundamentalsProvider()

    def _providers_for(self, cfg: FundamentalsConfig):
        provider_map = {
            "sec_edgar": self._sec_edgar_provider,
            "yfinance": self._yfinance_provider,
            "degiro": self._degiro_provider,
        }
        providers = [provider_map[name] for name in cfg.providers if name in provider_map]
        if not providers:
            raise ValueError("No supported fundamentals provider configured.")
        return providers

    def _should_reuse_cached_snapshot(
        self,
        snapshot: FundamentalSnapshot | None,
        *,
        cfg: FundamentalsConfig,
        force_refresh: bool,
    ) -> bool:
        if snapshot is None or force_refresh:
            return False
        if self._storage.is_snapshot_expired(snapshot, cfg.cache_ttl_hours):
            return False
        if TRUST_METADATA_MISSING_FLAG in snapshot.data_quality_flags:
            return False
        return True

    def get_snapshot(
        self,
        symbol: str,
        *,
        cfg: FundamentalsConfig,
        force_refresh: bool = False,
    ):
        normalized_symbol = _normalize_symbol(symbol)
        cached = self._storage.load_snapshot(normalized_symbol)
        if self._should_reuse_cached_snapshot(cached, cfg=cfg, force_refresh=force_refresh):
            return cached

        providers = self._providers_for(cfg)
        snapshot = None
        last_error: Exception | None = None
        last_provider_name = "unknown"
        for provider in providers:
            last_provider_name = provider.name
            try:
                record = provider.fetch_record(normalized_symbol)
                snapshot = build_snapshot(record, cfg)
                break
            except Exception as exc:
                last_error = exc
                continue
        if snapshot is None:
            if cached is not None:
                return cached
            snapshot = build_provider_error_snapshot(
                normalized_symbol,
                last_provider_name,
                str(last_error or "No fundamentals providers succeeded."),
            )

        self._storage.save_snapshot(snapshot)
        return snapshot

    def compare_symbols(
        self,
        symbols: list[str] | tuple[str, ...],
        *,
        cfg: FundamentalsConfig,
        force_refresh: bool = False,
    ) -> list:
        unique: list[str] = []
        for symbol in symbols:
            normalized = _normalize_symbol(symbol)
            if normalized not in unique:
                unique.append(normalized)
        return [
            self.get_snapshot(symbol, cfg=cfg, force_refresh=force_refresh)
            for symbol in unique[: cfg.compare_limit]
        ]
