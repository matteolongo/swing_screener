"""Background backtest run jobs.

Mirrors `screener_run_manager`: a thread-backed, disk-persisted job store so a
long multi-symbol replay can run past the request budget and be polled by the UI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
import logging
from pathlib import Path
import threading
import uuid
from typing import Callable, Optional

from api.models.backtest import EventStudyResponse

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


@dataclass
class BacktestRunJob:
    job_id: str
    status: str
    result: Optional[EventStudyResponse]
    error: Optional[str]
    created_at: str
    updated_at: str


class BacktestRunManager:
    def __init__(
        self,
        *,
        max_jobs: int = 32,
        jobs_dir: str | Path = "data/backtest/jobs",
    ) -> None:
        self._jobs: dict[str, BacktestRunJob] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs
        self._jobs_dir = Path(jobs_dir)
        self._jobs_dir.mkdir(parents=True, exist_ok=True)
        self._load_jobs()

    def _job_file(self, job_id: str) -> Path:
        return self._jobs_dir / f"{job_id}.json"

    def _serialize_job(self, job: BacktestRunJob) -> dict:
        return {
            "job_id": job.job_id,
            "status": job.status,
            "result": job.result.model_dump() if job.result is not None else None,
            "error": job.error,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }

    def _parse_job_payload(
        self, payload: object, *, now: str
    ) -> Optional[BacktestRunJob]:
        if not isinstance(payload, dict):
            return None
        try:
            result_payload = payload.get("result")
            result = (
                EventStudyResponse.model_validate(result_payload)
                if isinstance(result_payload, dict)
                else None
            )
            job = BacktestRunJob(
                job_id=str(payload.get("job_id", "")).strip(),
                status=str(payload.get("status", "error")).strip().lower(),
                result=result,
                error=str(payload.get("error")) if payload.get("error") else None,
                created_at=str(payload.get("created_at", now)),
                updated_at=str(payload.get("updated_at", now)),
            )
        except Exception:
            return None
        if not job.job_id:
            return None
        return job

    def _write_job_to_disk(self, job: BacktestRunJob) -> None:
        target = self._job_file(job.job_id)
        tmp = target.with_suffix(".tmp")
        try:
            tmp.write_text(
                json.dumps(self._serialize_job(job), indent=2, ensure_ascii=False)
                + "\n",
                encoding="utf-8",
            )
            tmp.replace(target)
        except Exception as exc:
            logger.warning(
                "Failed to persist backtest job %s to %s: %s", job.job_id, target, exc
            )
            try:
                tmp.unlink(missing_ok=True)
            except Exception as rm_exc:
                logger.debug(
                    "Failed to remove temp backtest job file %s: %s", tmp, rm_exc
                )

    def _read_job_from_disk(self, job_id: str) -> Optional[BacktestRunJob]:
        path = self._job_file(job_id)
        if not path.exists():
            return None
        now = _now_iso()
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
        return self._parse_job_payload(payload, now=now)

    def _load_jobs(self) -> None:
        now = _now_iso()
        loaded: list[BacktestRunJob] = []
        for path in sorted(self._jobs_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            job = self._parse_job_payload(payload, now=now)
            if job is None:
                continue
            corrected = False
            if job.status not in {"queued", "running", "completed", "error"}:
                job.status = "error"
                job.error = "Recovered invalid job status from disk."
                job.updated_at = now
                corrected = True
            if job.status in {"queued", "running"}:
                job.status = "error"
                job.result = None
                job.error = "Run interrupted by API restart."
                job.updated_at = now
                corrected = True
            if corrected:
                self._write_job_to_disk(job)
            loaded.append(job)

        loaded.sort(key=lambda item: item.updated_at)
        if len(loaded) > self._max_jobs:
            loaded = loaded[-self._max_jobs :]

        with self._lock:
            for job in loaded:
                self._jobs[job.job_id] = job
            self._trim_jobs_locked()

    def start_job(self, *, run_fn: Callable[[], EventStudyResponse]) -> str:
        now = _now_iso()
        job_id = uuid.uuid4().hex
        job = BacktestRunJob(
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
        self._write_job_to_disk(job)

        worker = threading.Thread(
            target=self._run_job,
            kwargs={"job_id": job_id, "run_fn": run_fn},
            daemon=True,
        )
        worker.start()
        return job_id

    def get_job(self, job_id: str) -> Optional[BacktestRunJob]:
        disk_job = self._read_job_from_disk(job_id)
        if disk_job is not None:
            with self._lock:
                self._jobs[job_id] = disk_job
                self._trim_jobs_locked()
            return BacktestRunJob(**disk_job.__dict__)

        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            return BacktestRunJob(**job.__dict__)

    def _run_job(
        self, *, job_id: str, run_fn: Callable[[], EventStudyResponse]
    ) -> None:
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
        result: Optional[EventStudyResponse] = None,
        error: Optional[str] = None,
    ) -> None:
        snapshot: Optional[BacktestRunJob] = None
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            job.result = result
            job.error = error
            job.updated_at = _now_iso()
            snapshot = BacktestRunJob(**job.__dict__)
        if snapshot is not None:
            self._write_job_to_disk(snapshot)

    def _trim_jobs_locked(self) -> None:
        if len(self._jobs) <= self._max_jobs:
            return
        terminal_jobs = sorted(
            (
                job
                for job in self._jobs.values()
                if job.status in {"completed", "error"}
            ),
            key=lambda item: item.updated_at,
        )
        to_remove = len(self._jobs) - self._max_jobs
        for item in terminal_jobs[:to_remove]:
            self._jobs.pop(item.job_id, None)
            try:
                self._job_file(item.job_id).unlink(missing_ok=True)
            except Exception:
                logger.debug(
                    "Failed to remove evicted backtest job file for %s",
                    item.job_id,
                    exc_info=True,
                )


_MANAGER = BacktestRunManager()


def get_backtest_run_manager() -> BacktestRunManager:
    return _MANAGER
