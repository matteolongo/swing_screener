"""Thread-backed, disk-persisted background jobs polled by the UI.

Screener runs, backtest runs and pool enrichment can outlast the request
budget, so each runs on a daemon thread and its record is written to one JSON
file per job. A restart recovers jobs that were still active as failed instead
of returning 404, and only terminal jobs are evicted when the store is full.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime
from functools import cache
import json
import logging
from pathlib import Path
import threading
import uuid
from typing import Any, Callable, ClassVar, Generic, Optional, TypeVar

from pydantic import BaseModel

from api.models.backtest import EventStudyResponse
from api.models.screener import ScreenerResponse

logger = logging.getLogger(__name__)

JobT = TypeVar("JobT")
ResultT = TypeVar("ResultT", bound=BaseModel)


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0, tzinfo=None).isoformat()


class JobStore(Generic[JobT]):
    statuses: ClassVar[frozenset[str]]
    terminal_statuses: ClassVar[frozenset[str]]
    failed_status: ClassVar[str]
    interrupted_error: ClassVar[str]
    label: ClassVar[str]
    default_jobs_dir: ClassVar[str]
    # Memory-first reads keep in-memory progress visible; disk-first reads let
    # requests served by another worker see the latest status and result.
    read_memory_first: ClassVar[bool] = False

    def __init__(self, *, max_jobs: int = 32, jobs_dir: str | Path | None = None) -> None:
        self._jobs: dict[str, JobT] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs
        self._jobs_dir = Path(jobs_dir or self.default_jobs_dir)
        self._jobs_dir.mkdir(parents=True, exist_ok=True)
        self._load_jobs()

    def _serialize_job(self, job: JobT) -> dict:
        return asdict(job)

    def _parse_job(self, payload: dict, *, now: str) -> JobT:
        raise NotImplementedError

    def _job_file(self, job_id: str) -> Path:
        return self._jobs_dir / f"{job_id}.json"

    def _parse_job_payload(self, payload: object, *, now: str) -> Optional[JobT]:
        if not isinstance(payload, dict) or not str(payload.get("job_id", "")).strip():
            return None
        try:
            return self._parse_job(payload, now=now)
        except Exception:
            return None

    def _read_job_file(self, path: Path, *, now: str) -> Optional[JobT]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
        return self._parse_job_payload(payload, now=now)

    def _write_job_to_disk(self, job: Any) -> None:
        target = self._job_file(job.job_id)
        tmp = target.with_suffix(".tmp")
        try:
            tmp.write_text(
                json.dumps(self._serialize_job(job), indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            tmp.replace(target)
        except Exception as exc:
            logger.warning(
                "Failed to persist %s job %s to %s: %s", self.label, job.job_id, target, exc
            )
            tmp.unlink(missing_ok=True)

    def _load_jobs(self) -> None:
        now = _now_iso()
        loaded: list[Any] = []
        for path in sorted(self._jobs_dir.glob("*.json")):
            job: Any = self._read_job_file(path, now=now)
            if job is None:
                continue
            if job.status not in self.statuses:
                job.status = self.failed_status
                job.error = "Recovered invalid job status from disk."
            elif job.status not in self.terminal_statuses:
                job.status = self.failed_status
                job.error = self.interrupted_error
            else:
                loaded.append(job)
                continue
            job.updated_at = now
            self._write_job_to_disk(job)
            loaded.append(job)

        loaded.sort(key=lambda item: item.updated_at)
        with self._lock:
            for job in loaded[-self._max_jobs :]:
                self._jobs[job.job_id] = job
            self._trim_jobs_locked()

    def _add_and_run(self, job: Any, target: Callable[..., None], **kwargs: Any) -> str:
        with self._lock:
            self._jobs[job.job_id] = job
            self._trim_jobs_locked()
        self._write_job_to_disk(job)
        threading.Thread(target=target, kwargs=kwargs, daemon=True).start()
        return job.job_id

    def get_job(self, job_id: str) -> Optional[JobT]:
        if self.read_memory_first:
            with self._lock:
                job = self._jobs.get(job_id)
                if job is not None:
                    return replace(job)
        disk_job = self._read_job_file(self._job_file(job_id), now=_now_iso())
        if disk_job is not None:
            with self._lock:
                self._jobs[job_id] = disk_job
                self._trim_jobs_locked()
            return replace(disk_job)
        with self._lock:
            job = self._jobs.get(job_id)
            return replace(job) if job is not None else None

    def _modify(self, job_id: str, *, persist: bool = True, **changes: Any) -> None:
        with self._lock:
            job: Any = self._jobs.get(job_id)
            if job is None:
                return
            for name, value in changes.items():
                setattr(job, name, value)
            job.updated_at = _now_iso()
            snapshot = replace(job)
        if persist:
            self._write_job_to_disk(snapshot)

    def _trim_jobs_locked(self) -> None:
        # Only terminal jobs are evictable: trimming a queued/running job would
        # drop its result mid-flight and 404 the client polling it. The map may
        # temporarily exceed max_jobs when everything in excess is still active.
        if len(self._jobs) <= self._max_jobs:
            return
        terminal = sorted(
            (job for job in self._jobs.values() if job.status in self.terminal_statuses),  # type: ignore[attr-defined]
            key=lambda item: item.updated_at,  # type: ignore[attr-defined]
        )
        for item in terminal[: len(self._jobs) - self._max_jobs]:
            self._jobs.pop(item.job_id, None)  # type: ignore[attr-defined]
            self._job_file(item.job_id).unlink(missing_ok=True)  # type: ignore[attr-defined]


@dataclass
class RunJob(Generic[ResultT]):
    job_id: str
    status: str  # queued | running | completed | error
    result: Optional[ResultT]
    error: Optional[str]
    created_at: str
    updated_at: str


class RunManager(JobStore[RunJob[ResultT]]):
    """Jobs whose run function returns one Pydantic response model."""

    result_model: ClassVar[type[BaseModel]]
    statuses = frozenset({"queued", "running", "completed", "error"})
    terminal_statuses = frozenset({"completed", "error"})
    failed_status = "error"
    interrupted_error = "Run interrupted by API restart."

    def _serialize_job(self, job: RunJob[ResultT]) -> dict:
        return {
            **asdict(job),
            "result": job.result.model_dump() if job.result is not None else None,
        }

    def _parse_job(self, payload: dict, *, now: str) -> RunJob[ResultT]:
        result = payload.get("result")
        return RunJob(
            job_id=str(payload["job_id"]).strip(),
            status=str(payload.get("status", "error")).strip().lower(),
            result=self.result_model.model_validate(result) if isinstance(result, dict) else None,  # type: ignore[arg-type]
            error=str(payload.get("error")) if payload.get("error") else None,
            created_at=str(payload.get("created_at", now)),
            updated_at=str(payload.get("updated_at", now)),
        )

    def start_job(self, *, run_fn: Callable[[], ResultT]) -> str:
        now = _now_iso()
        job: RunJob[ResultT] = RunJob(uuid.uuid4().hex, "queued", None, None, now, now)
        return self._add_and_run(job, self._run_job, job_id=job.job_id, run_fn=run_fn)

    def _run_job(self, *, job_id: str, run_fn: Callable[[], ResultT]) -> None:
        self._modify(job_id, status="running", result=None, error=None)
        try:
            result = run_fn()
            self._modify(job_id, status="completed", result=result, error=None)
        except Exception as exc:  # pragma: no cover - defensive path
            self._modify(job_id, status="error", result=None, error=str(exc))


class ScreenerRunManager(RunManager[ScreenerResponse]):
    result_model = ScreenerResponse
    label = "screener"
    default_jobs_dir = "data/screener/jobs"


class BacktestRunManager(RunManager[EventStudyResponse]):
    result_model = EventStudyResponse
    label = "backtest"
    default_jobs_dir = "data/backtest/jobs"


# Reporter signature handed to the enrichment function: (processed, total, failed).
ProgressReporter = Callable[[int, int, int], None]
EnrichRunFn = Callable[[ProgressReporter], dict]


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


class PoolEnrichRunManager(JobStore[PoolEnrichJob]):
    """Enrichment jobs with live progress counters.

    Progress ticks stay in memory (no disk write per tick); the record is
    persisted on each status transition.
    """

    statuses = frozenset({"running", "done", "failed"})
    terminal_statuses = frozenset({"done", "failed"})
    failed_status = "failed"
    interrupted_error = "Enrichment interrupted by API restart."
    label = "pool enrich"
    default_jobs_dir = "data/pool/enrich_jobs"
    read_memory_first = True

    def __init__(self, *, max_jobs: int = 16, jobs_dir: str | Path | None = None) -> None:
        super().__init__(max_jobs=max_jobs, jobs_dir=jobs_dir)

    def _parse_job(self, payload: dict, *, now: str) -> PoolEnrichJob:
        result = payload.get("result")
        return PoolEnrichJob(
            job_id=str(payload["job_id"]).strip(),
            status=str(payload.get("status", "failed")).strip().lower(),
            processed=int(payload.get("processed", 0) or 0),
            total=int(payload.get("total", 0) or 0),
            failed=int(payload.get("failed", 0) or 0),
            error=str(payload.get("error")) if payload.get("error") else None,
            result=result if isinstance(result, dict) else None,
            created_at=str(payload.get("created_at", now)),
            updated_at=str(payload.get("updated_at", now)),
        )

    def start_job(self, *, run_fn: EnrichRunFn) -> str:
        now = _now_iso()
        job = PoolEnrichJob(uuid.uuid4().hex, "running", 0, 0, 0, None, None, now, now)
        return self._add_and_run(job, self._run_job, job_id=job.job_id, run_fn=run_fn)

    def _run_job(self, *, job_id: str, run_fn: EnrichRunFn) -> None:
        def report(processed: int, total: int, failed: int) -> None:
            self._modify(job_id, persist=False, processed=processed, total=total, failed=failed)

        try:
            result = run_fn(report)
            self._modify(job_id, status="done", result=result, error=None)
        except Exception as exc:  # noqa: BLE001 - surface as failed job
            self._modify(job_id, status="failed", result=None, error=str(exc))


@cache
def get_screener_run_manager() -> ScreenerRunManager:
    return ScreenerRunManager()


@cache
def get_backtest_run_manager() -> BacktestRunManager:
    return BacktestRunManager()


@cache
def get_pool_enrich_run_manager() -> PoolEnrichRunManager:
    return PoolEnrichRunManager()
