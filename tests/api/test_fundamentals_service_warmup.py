from __future__ import annotations

from api.models.fundamentals import FundamentalsWarmupRequest
from api.models.watchlist import WatchItem
from api.services.fundamentals_service import FundamentalsService


class _FakeConfigRepo:
    def load_raw(self):
        return {
            "enabled": True,
            "providers": ["yfinance"],
            "cache_ttl_hours": 24,
            "stale_after_days": 120,
            "compare_limit": 5,
        }

    def save_raw(self, payload):
        return None


class _FakeWatchlistRepo:
    def list_items(self):
        return [
            WatchItem(ticker="AAPL", source="watchlist"),
            WatchItem(ticker="MSFT", source="watchlist"),
        ]


class _FakeWarmupJob:
    job_id = "warmup-123"
    status = "queued"
    source = "watchlist"
    force_refresh = False
    total_symbols = 2
    completed_symbols = 0
    coverage_supported_count = 0
    coverage_partial_count = 0
    coverage_insufficient_count = 0
    coverage_unsupported_count = 0
    freshness_current_count = 0
    freshness_stale_count = 0
    freshness_unknown_count = 0
    error_count = 0
    last_completed_symbol = None
    error_sample = None
    created_at = "2026-03-19T10:00:00"
    updated_at = "2026-03-19T10:00:00"


class _FakeWarmupManager:
    def __init__(self):
        self.last_call = None

    def start_job(self, *, symbols, source, force_refresh, cfg):
        self.last_call = {
            "symbols": list(symbols),
            "source": source,
            "force_refresh": force_refresh,
            "cfg": cfg,
        }
        return "warmup-123"

    def get_job(self, job_id: str):
        if job_id != "warmup-123":
            return None
        return _FakeWarmupJob()


def test_fundamentals_service_starts_watchlist_warmup():
    warmup_manager = _FakeWarmupManager()
    service = FundamentalsService(
        config_repo=_FakeConfigRepo(),
        watchlist_repo=_FakeWatchlistRepo(),
        warmup_manager=warmup_manager,
    )

    response = service.start_warmup(
        FundamentalsWarmupRequest(source="watchlist", symbols=[], force_refresh=False)
    )

    assert response.job_id == "warmup-123"
    assert response.total_symbols == 2
    assert warmup_manager.last_call is not None
    assert warmup_manager.last_call["symbols"] == ["AAPL", "MSFT"]
    assert warmup_manager.last_call["source"] == "watchlist"
