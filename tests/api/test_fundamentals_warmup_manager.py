from __future__ import annotations

import time

from api.services.fundamentals_warmup import FundamentalsWarmupManager
from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import FundamentalSnapshot


class _FakeAnalysisService:
    def get_snapshot(self, symbol: str, *, cfg: FundamentalsConfig, force_refresh: bool = False):
        normalized = str(symbol).strip().upper()
        if normalized == "ETF":
            return FundamentalSnapshot(
                symbol=normalized,
                asof_date="2026-03-19",
                provider="yfinance",
                updated_at="2026-03-19T10:00:00",
                supported=False,
                coverage_status="unsupported",
                freshness_status="unknown",
                highlights=["Instrument is not a single-company equity."],
            )
        if normalized == "ERR":
            return FundamentalSnapshot(
                symbol=normalized,
                asof_date="2026-03-19",
                provider="yfinance",
                updated_at="2026-03-19T10:00:00",
                coverage_status="partial",
                freshness_status="stale",
                error="Provider throttled this symbol.",
                highlights=["Provider call failed; no fresh fundamental snapshot is available."],
            )
        return FundamentalSnapshot(
            symbol=normalized,
            asof_date="2026-03-19",
            provider="yfinance",
            updated_at="2026-03-19T10:00:00",
            coverage_status="supported",
            freshness_status="current",
            highlights=["Growth metrics are supportive."],
        )


def _wait_for_completion(manager: FundamentalsWarmupManager, job_id: str, timeout_seconds: float = 5.0):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        job = manager.get_job(job_id)
        if job is not None and job.status in {"completed", "error"}:
            return job
        time.sleep(0.05)
    raise AssertionError("Fundamentals warmup job did not finish in time.")


def test_fundamentals_warmup_manager_tracks_progress_and_counts(tmp_path):
    manager = FundamentalsWarmupManager(
        analysis_service=_FakeAnalysisService(),
        jobs_path=tmp_path / "fundamentals" / "warmup_jobs.json",
    )

    job_id = manager.start_job(
        symbols=["aapl", "err", "etf"],
        source="symbols",
        force_refresh=False,
        cfg=FundamentalsConfig(),
    )

    assert job_id is not None
    final_job = _wait_for_completion(manager, job_id)

    assert final_job.status == "completed"
    assert final_job.total_symbols == 3
    assert final_job.completed_symbols == 3
    assert final_job.coverage_supported_count == 1
    assert final_job.coverage_partial_count == 1
    assert final_job.coverage_unsupported_count == 1
    assert final_job.freshness_current_count == 1
    assert final_job.freshness_stale_count == 1
    assert final_job.freshness_unknown_count == 1
    assert final_job.error_count == 1
    assert final_job.last_completed_symbol == "ETF"
    assert final_job.error_sample == "Provider throttled this symbol."
