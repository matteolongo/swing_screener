"""Background screener run jobs."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import threading
import uuid
from typing import Callable, Optional

from api.models.screener import ScreenerResponse


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


@dataclass
class ScreenerRunJob:
    job_id: str
    status: str
    result: Optional[ScreenerResponse]
    error: Optional[str]
    created_at: str
    updated_at: str


class ScreenerRunManager:
    def __init__(self, *, max_jobs: int = 32) -> None:
        self._jobs: dict[str, ScreenerRunJob] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs

    def start_job(self, *, run_fn: Callable[[], ScreenerResponse]) -> str:
        now = _now_iso()
        job_id = uuid.uuid4().hex
        job = ScreenerRunJob(
            job_id=job_id,
            status="queued",
            result=None,
            error=None,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._jobs[job_id] = job
            self._trim_jobs_locked()

        worker = threading.Thread(
            target=self._run_job,
            kwargs={"job_id": job_id, "run_fn": run_fn},
            daemon=True,
        )
        worker.start()
        return job_id

    def get_job(self, job_id: str) -> Optional[ScreenerRunJob]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            return ScreenerRunJob(**job.__dict__)

    def _run_job(self, *, job_id: str, run_fn: Callable[[], ScreenerResponse]) -> None:
        self._update(job_id, status="running", result=None, error=None)
        try:
            result = run_fn()
            self._update(job_id, status="completed", result=result, error=None)
        except Exception as exc:  # pragma: no cover - defensive path
            self._update(job_id, status="error", result=None, error=str(exc))

    def _update(
        self,
        job_id: str,
        *,
        status: Optional[str] = None,
        result: Optional[ScreenerResponse] = None,
        error: Optional[str] = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            job.result = result
            job.error = error
            job.updated_at = _now_iso()

    def _trim_jobs_locked(self) -> None:
        if len(self._jobs) <= self._max_jobs:
            return
        sorted_jobs = sorted(self._jobs.values(), key=lambda item: item.updated_at)
        to_remove = len(self._jobs) - self._max_jobs
        for item in sorted_jobs[:to_remove]:
            self._jobs.pop(item.job_id, None)


_MANAGER = ScreenerRunManager()


def get_screener_run_manager() -> ScreenerRunManager:
    return _MANAGER
