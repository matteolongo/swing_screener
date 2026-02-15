"""Background market intelligence run jobs."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import threading
import uuid
from typing import Optional

from swing_screener.intelligence.config import IntelligenceConfig
from swing_screener.intelligence.pipeline import run_intelligence_pipeline


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


@dataclass
class IntelligenceRunJob:
    job_id: str
    status: str
    total_symbols: int
    completed_symbols: int
    asof_date: str | None
    opportunities_count: int
    error: str | None
    created_at: str
    updated_at: str


class IntelligenceRunManager:
    def __init__(self, *, max_jobs: int = 64) -> None:
        self._jobs: dict[str, IntelligenceRunJob] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs

    def start_job(
        self,
        *,
        symbols: list[str],
        cfg: IntelligenceConfig,
        technical_readiness: dict[str, float] | None,
    ) -> Optional[str]:
        cleaned = []
        seen: set[str] = set()
        for symbol in symbols:
            text = str(symbol).strip().upper()
            if text and text not in seen:
                seen.add(text)
                cleaned.append(text)
        if not cleaned:
            return None

        now = _now_iso()
        job_id = uuid.uuid4().hex
        job = IntelligenceRunJob(
            job_id=job_id,
            status="queued",
            total_symbols=len(cleaned),
            completed_symbols=0,
            asof_date=None,
            opportunities_count=0,
            error=None,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._jobs[job_id] = job
            self._trim_jobs_locked()

        worker = threading.Thread(
            target=self._run_job,
            kwargs={
                "job_id": job_id,
                "symbols": cleaned,
                "cfg": cfg,
                "technical_readiness": technical_readiness,
            },
            daemon=True,
        )
        worker.start()
        return job_id

    def get_job(self, job_id: str) -> Optional[IntelligenceRunJob]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            return IntelligenceRunJob(**job.__dict__)

    def _run_job(
        self,
        *,
        job_id: str,
        symbols: list[str],
        cfg: IntelligenceConfig,
        technical_readiness: dict[str, float] | None,
    ) -> None:
        self._update(job_id, status="running")
        try:
            snapshot = run_intelligence_pipeline(
                symbols=symbols,
                cfg=cfg,
                technical_readiness=technical_readiness,
            )
            self._update(
                job_id,
                status="completed",
                completed_symbols=len(snapshot.symbols),
                asof_date=snapshot.asof_date,
                opportunities_count=len(snapshot.opportunities),
                error=None,
            )
        except Exception as exc:
            self._update(
                job_id,
                status="error",
                completed_symbols=0,
                opportunities_count=0,
                error=str(exc),
            )

    def _update(
        self,
        job_id: str,
        *,
        status: str | None = None,
        completed_symbols: int | None = None,
        asof_date: str | None = None,
        opportunities_count: int | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            if completed_symbols is not None:
                job.completed_symbols = completed_symbols
            if asof_date is not None:
                job.asof_date = asof_date
            if opportunities_count is not None:
                job.opportunities_count = opportunities_count
            job.error = error
            job.updated_at = _now_iso()

    def _trim_jobs_locked(self) -> None:
        if len(self._jobs) <= self._max_jobs:
            return
        sorted_jobs = sorted(self._jobs.values(), key=lambda item: item.updated_at)
        to_remove = len(self._jobs) - self._max_jobs
        for item in sorted_jobs[:to_remove]:
            self._jobs.pop(item.job_id, None)


_MANAGER = IntelligenceRunManager()


def get_intelligence_run_manager() -> IntelligenceRunManager:
    return _MANAGER

