from __future__ import annotations

import time

from api.models.screener import ScreenerResponse
from api.services.screener_run_manager import ScreenerRunManager


def test_screener_run_manager_persists_jobs_across_instances(tmp_path):
    jobs_dir = tmp_path / "jobs"
    manager_a = ScreenerRunManager(max_jobs=8, jobs_dir=jobs_dir)

    expected_result = ScreenerResponse(
        candidates=[],
        asof_date="2026-02-26",
        total_screened=42,
        data_freshness="final_close",
        warnings=[],
        social_warmup_job_id=None,
    )

    job_id = manager_a.start_job(run_fn=lambda: expected_result)

    completed = None
    for _ in range(40):
        job = manager_a.get_job(job_id)
        if job and job.status == "completed":
            completed = job
            break
        time.sleep(0.05)

    assert completed is not None
    assert completed.result is not None
    assert completed.result.total_screened == 42

    manager_b = ScreenerRunManager(max_jobs=8, jobs_dir=jobs_dir)
    recovered = manager_b.get_job(job_id)
    assert recovered is not None
    assert recovered.status == "completed"
    assert recovered.result is not None
    assert recovered.result.asof_date == "2026-02-26"
