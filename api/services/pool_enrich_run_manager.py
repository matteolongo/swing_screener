"""Background pool-enrichment jobs.

Mirrors ``backtest_run_manager`` / ``screener_run_manager``: a thread-backed,
disk-persisted job store so a multi-minute yfinance enrichment pass can run past
the request budget and be polled by the UI. Unlike those managers the job also
carries live progress counters (processed/total/failed); progress is in-memory
only (no disk write per tick), and the job record is persisted on each status
transition so an API restart recovers interrupted jobs as ``failed`` instead of
returning 404.
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

logger = logging.getLogger(__name__)

# Reporter signature handed to the run function: (processed, total, failed).
ProgressReporter = Callable[[int, int, int], None]
EnrichRunFn = Callable[[ProgressReporter], dict]


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


@dataclass
class PoolEnrichJob:
    job_id: str
    status: str  # running | done | failed
    processed: int
    total: int
    failed: int
    error: Optional[str]
    result: Optional[dict]  # {"modified": [...], "failed_symbols": [...]}
    created_at: str
    updated_at: str


class PoolEnrichRunManager:
    def __init__(
        self,
        *,
        max_jobs: int = 16,
        jobs_dir: str | Path = "data/pool/enrich_jobs",
    ) -> None:
        self._jobs: dict[str, PoolEnrichJob] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs
        self._jobs_dir = Path(jobs_dir)
        self._jobs_dir.mkdir(parents=True, exist_ok=True)
        self._load_jobs()

    def _job_file(self, job_id: str) -> Path:
        return self._jobs_dir / f"{job_id}.json"

    def _serialize_job(self, job: PoolEnrichJob) -> dict:
        return {
            "job_id": job.job_id,
            "status": job.status,
            "processed": job.processed,
            "total": job.total,
            "failed": job.failed,
            "error": job.error,
            "result": job.result,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }

    def _parse_job_payload(self, payload: object) -> Optional[PoolEnrichJob]:
        if not isinstance(payload, dict):
            return None
        job_id = str(payload.get("job_id", "")).strip()
        if not job_id:
            return None
        result = payload.get("result")
        return PoolEnrichJob(
            job_id=job_id,
            status=str(payload.get("status", "failed")).strip().lower(),
            processed=int(payload.get("processed", 0) or 0),
            total=int(payload.get("total", 0) or 0),
            failed=int(payload.get("failed", 0) or 0),
            error=str(payload.get("error")) if payload.get("error") else None,
            result=result if isinstance(result, dict) else None,
            created_at=str(payload.get("created_at", _now_iso())),
            updated_at=str(payload.get("updated_at", _now_iso())),
        )

    def _write_job_to_disk(self, job: PoolEnrichJob) -> None:
        target = self._job_file(job.job_id)
        tmp = target.with_suffix(".tmp")
        try:
            tmp.write_text(
                json.dumps(self._serialize_job(job), indent=2, ensure_ascii=False)
                + "\n",
                encoding="utf-8",
            )
            tmp.replace(target)
        except Exception as exc:  # noqa: BLE001 - persistence is best-effort
            logger.warning(
                "Failed to persist enrich job %s to %s: %s", job.job_id, target, exc
            )
            try:
                tmp.unlink(missing_ok=True)
            except Exception:  # noqa: BLE001
                logger.debug("Failed to remove temp enrich job file %s", tmp)

    def _read_job_from_disk(self, job_id: str) -> Optional[PoolEnrichJob]:
        path = self._job_file(job_id)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return None
        return self._parse_job_payload(payload)

    def _load_jobs(self) -> None:
        now = _now_iso()
        loaded: list[PoolEnrichJob] = []
        for path in sorted(self._jobs_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                continue
            job = self._parse_job_payload(payload)
            if job is None:
                continue
            if job.status not in {"running", "done", "failed"}:
                job.status = "failed"
                job.error = "Recovered invalid job status from disk."
                job.updated_at = now
                self._write_job_to_disk(job)
            elif job.status == "running":
                job.status = "failed"
                job.error = "Enrichment interrupted by API restart."
                job.updated_at = now
                self._write_job_to_disk(job)
            loaded.append(job)

        loaded.sort(key=lambda item: item.updated_at)
        if len(loaded) > self._max_jobs:
            loaded = loaded[-self._max_jobs :]

        with self._lock:
            for job in loaded:
                self._jobs[job.job_id] = job
            self._trim_jobs_locked()

    def start_job(self, *, run_fn: EnrichRunFn) -> str:
        now = _now_iso()
        job_id = uuid.uuid4().hex
        job = PoolEnrichJob(
            job_id=job_id,
            status="running",
            processed=0,
            total=0,
            failed=0,
            error=None,
            result=None,
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

    def get_job(self, job_id: str) -> Optional[PoolEnrichJob]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                return PoolEnrichJob(**job.__dict__)
        disk_job = self._read_job_from_disk(job_id)
        if disk_job is not None:
            with self._lock:
                self._jobs[job_id] = disk_job
                self._trim_jobs_locked()
            return PoolEnrichJob(**disk_job.__dict__)
        return None

    def _make_reporter(self, job_id: str) -> ProgressReporter:
        def report(processed: int, total: int, failed: int) -> None:
            # In-memory only — progress ticks must not hammer the disk.
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                job.processed = processed
                job.total = total
                job.failed = failed
                job.updated_at = _now_iso()

        return report

    def _run_job(self, *, job_id: str, run_fn: EnrichRunFn) -> None:
        try:
            result = run_fn(self._make_reporter(job_id))
            self._finish(job_id, status="done", result=result, error=None)
        except Exception as exc:  # noqa: BLE001 - surface as failed job
            self._finish(job_id, status="failed", result=None, error=str(exc))

    def _finish(
        self,
        job_id: str,
        *,
        status: str,
        result: Optional[dict],
        error: Optional[str],
    ) -> None:
        snapshot: Optional[PoolEnrichJob] = None
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = status
            job.result = result
            job.error = error
            job.updated_at = _now_iso()
            snapshot = PoolEnrichJob(**job.__dict__)
        if snapshot is not None:
            self._write_job_to_disk(snapshot)

    def _trim_jobs_locked(self) -> None:
        if len(self._jobs) <= self._max_jobs:
            return
        terminal = sorted(
            (j for j in self._jobs.values() if j.status in {"done", "failed"}),
            key=lambda item: item.updated_at,
        )
        to_remove = len(self._jobs) - self._max_jobs
        for item in terminal[:to_remove]:
            self._jobs.pop(item.job_id, None)
            try:
                self._job_file(item.job_id).unlink(missing_ok=True)
            except Exception:  # noqa: BLE001
                logger.debug("Failed to remove evicted enrich job %s", item.job_id)


_MANAGER = PoolEnrichRunManager()


def get_pool_enrich_run_manager() -> PoolEnrichRunManager:
    return _MANAGER
