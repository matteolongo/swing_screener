from __future__ import annotations

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import TRUST_METADATA_MISSING_FLAG, FundamentalSnapshot
from swing_screener.fundamentals.providers import YfinanceFundamentalsProvider
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
        yfinance_provider: YfinanceFundamentalsProvider | None = None,
    ) -> None:
        self._storage = storage or FundamentalsStorage()
        self._yfinance_provider = yfinance_provider or YfinanceFundamentalsProvider()

    def _provider_for(self, cfg: FundamentalsConfig) -> YfinanceFundamentalsProvider:
        if "yfinance" not in cfg.providers:
            raise ValueError("No supported fundamentals provider configured.")
        return self._yfinance_provider

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

        provider = self._provider_for(cfg)
        try:
            record = provider.fetch_record(normalized_symbol)
            snapshot = build_snapshot(record, cfg)
        except Exception as exc:
            if cached is not None:
                return cached
            snapshot = build_provider_error_snapshot(normalized_symbol, provider.name, str(exc))

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
