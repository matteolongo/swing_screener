from __future__ import annotations

import time

from api.models.backtest import BacktestMetricsModel, EventStudyResponse
from api.services.backtest_run_manager import BacktestRunManager


def _response() -> EventStudyResponse:
    return EventStudyResponse(
        tickers=["TEST"],
        start="2022-01-01",
        end="2022-02-01",
        trades=[],
        metrics=BacktestMetricsModel(
            n_trades=0,
            win_rate=0.0,
            expectancy_r=0.0,
            total_r=0.0,
            profit_factor=None,
            avg_win_r=0.0,
            avg_loss_r=0.0,
            avg_bars_held=0.0,
            max_drawdown_r=0.0,
        ),
    )


def _await_terminal(manager: BacktestRunManager, job_id: str, timeout: float = 5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = manager.get_job(job_id)
        if job is not None and job.status in {"completed", "error"}:
            return job
        time.sleep(0.02)
    raise AssertionError("job did not reach a terminal state in time")


def test_completed_job_carries_result(tmp_path):
    manager = BacktestRunManager(jobs_dir=tmp_path / "jobs")
    job_id = manager.start_job(run_fn=_response)

    job = _await_terminal(manager, job_id)

    assert job.status == "completed"
    assert job.result is not None
    assert job.result.tickers == ["TEST"]


def test_failed_run_is_recorded_as_error(tmp_path):
    manager = BacktestRunManager(jobs_dir=tmp_path / "jobs")

    def _boom() -> EventStudyResponse:
        raise RuntimeError("kaboom")

    job_id = manager.start_job(run_fn=_boom)
    job = _await_terminal(manager, job_id)

    assert job.status == "error"
    assert "kaboom" in (job.error or "")
