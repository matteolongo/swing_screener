import json
from types import SimpleNamespace

from api.services.intelligence_warmup import IntelligenceRunManager
from swing_screener.intelligence.config import IntelligenceConfig


class _ImmediateThread:
    def __init__(self, *, target, kwargs=None, daemon=None):
        self._target = target
        self._kwargs = kwargs or {}

    def start(self):
        self._target(**self._kwargs)


def test_intelligence_run_manager_persists_jobs(tmp_path, monkeypatch):
    jobs_path = tmp_path / "run_jobs.json"

    monkeypatch.setattr("api.services.intelligence_warmup.threading.Thread", _ImmediateThread)
    monkeypatch.setattr(
        "api.services.intelligence_warmup.run_intelligence_pipeline",
        lambda **kwargs: SimpleNamespace(
            symbols=("AAPL",),
            asof_date="2026-02-23",
            opportunities=[SimpleNamespace(symbol="AAPL")],
        ),
    )

    manager = IntelligenceRunManager(max_jobs=16, jobs_path=jobs_path)
    job_id = manager.start_job(
        symbols=["AAPL"],
        cfg=IntelligenceConfig(enabled=True),
        technical_readiness=None,
    )
    assert job_id is not None

    completed = manager.get_job(job_id)
    assert completed is not None
    assert completed.status == "completed"
    assert completed.completed_symbols == 1
    assert completed.opportunities_count == 1
    assert jobs_path.exists()

    restored_manager = IntelligenceRunManager(max_jobs=16, jobs_path=jobs_path)
    restored = restored_manager.get_job(job_id)
    assert restored is not None
    assert restored.status == "completed"
    assert restored.completed_symbols == 1
    assert restored.opportunities_count == 1


def test_intelligence_run_manager_marks_inflight_jobs_error_on_restart(tmp_path):
    jobs_path = tmp_path / "run_jobs.json"
    jobs_payload = [
        {
            "job_id": "job-running-1",
            "status": "running",
            "total_symbols": 3,
            "completed_symbols": 1,
            "asof_date": None,
            "opportunities_count": 0,
            "error": None,
            "created_at": "2026-02-23T10:00:00",
            "updated_at": "2026-02-23T10:00:05",
        },
        {
            "job_id": "job-queued-1",
            "status": "queued",
            "total_symbols": 2,
            "completed_symbols": 0,
            "asof_date": None,
            "opportunities_count": 0,
            "error": None,
            "created_at": "2026-02-23T10:01:00",
            "updated_at": "2026-02-23T10:01:00",
        },
    ]
    jobs_path.write_text(json.dumps(jobs_payload, indent=2), encoding="utf-8")

    manager = IntelligenceRunManager(max_jobs=16, jobs_path=jobs_path)

    running = manager.get_job("job-running-1")
    queued = manager.get_job("job-queued-1")
    assert running is not None
    assert queued is not None
    assert running.status == "error"
    assert queued.status == "error"
    assert (running.error or "").lower().find("restart") != -1
    assert (queued.error or "").lower().find("restart") != -1
