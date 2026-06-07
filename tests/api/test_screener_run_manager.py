from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

import pytest

from api.models.screener import ScreenerResponse
import api.services.screener_run_manager as run_manager_module
from api.services.screener_run_manager import ScreenerRunManager


class InlineThread:
    """Execute a thread target synchronously so job tests have no timing races."""

    def __init__(
        self,
        *,
        target: Callable[..., None],
        kwargs: dict,
        daemon: bool,
    ) -> None:
        self._target = target
        self._kwargs = kwargs
        self.daemon = daemon

    def start(self) -> None:
        self._target(**self._kwargs)


@pytest.fixture
def synchronous_jobs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(run_manager_module.threading, "Thread", InlineThread)


def _expected_result() -> ScreenerResponse:
    return ScreenerResponse(
        candidates=[],
        asof_date="2026-02-26",
        total_screened=42,
        data_freshness="final_close",
        warnings=[],
    )


def test_screener_run_manager_persists_jobs_across_instances(
    tmp_path: Path,
    synchronous_jobs: None,
):
    jobs_dir = tmp_path / "jobs"
    manager_a = ScreenerRunManager(max_jobs=8, jobs_dir=jobs_dir)

    job_id = manager_a.start_job(run_fn=_expected_result)

    completed = manager_a.get_job(job_id)
    assert completed is not None
    assert completed.status == "completed"
    assert completed.result is not None
    assert completed.result.total_screened == 42

    manager_b = ScreenerRunManager(max_jobs=8, jobs_dir=jobs_dir)
    recovered = manager_b.get_job(job_id)
    assert recovered is not None
    assert recovered.status == "completed"
    assert recovered.result is not None
    assert recovered.result.asof_date == "2026-02-26"


def test_screener_run_manager_persists_job_errors(
    tmp_path: Path,
    synchronous_jobs: None,
):
    jobs_dir = tmp_path / "jobs"
    manager_a = ScreenerRunManager(max_jobs=8, jobs_dir=jobs_dir)

    def fail_run() -> ScreenerResponse:
        raise RuntimeError("provider unavailable")

    job_id = manager_a.start_job(run_fn=fail_run)

    failed = manager_a.get_job(job_id)
    assert failed is not None
    assert failed.status == "error"
    assert failed.result is None
    assert failed.error == "provider unavailable"

    recovered = ScreenerRunManager(max_jobs=8, jobs_dir=jobs_dir).get_job(job_id)
    assert recovered is not None
    assert recovered.status == "error"
    assert recovered.error == "provider unavailable"


@pytest.mark.parametrize("interrupted_status", ["queued", "running"])
def test_screener_run_manager_marks_interrupted_jobs_as_errors(
    tmp_path: Path,
    interrupted_status: str,
):
    jobs_dir = tmp_path / "jobs"
    jobs_dir.mkdir()
    job_id = f"interrupted-{interrupted_status}"
    (jobs_dir / f"{job_id}.json").write_text(
        json.dumps(
            {
                "job_id": job_id,
                "status": interrupted_status,
                "result": None,
                "error": None,
                "created_at": "2026-02-26T12:00:00",
                "updated_at": "2026-02-26T12:00:00",
            }
        ),
        encoding="utf-8",
    )

    recovered = ScreenerRunManager(max_jobs=8, jobs_dir=jobs_dir).get_job(job_id)

    assert recovered is not None
    assert recovered.status == "error"
    assert recovered.result is None
    assert recovered.error == "Run interrupted by API restart."
