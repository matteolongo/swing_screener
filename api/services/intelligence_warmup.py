"""Background market intelligence run jobs."""
from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
from datetime import datetime
import logging
from pathlib import Path
import threading
import uuid
from typing import Optional

from api.services.intelligence_summary import build_intelligence_run_summary
from swing_screener.intelligence.config import IntelligenceConfig
from swing_screener.intelligence.pipeline import run_intelligence_pipeline
from swing_screener.utils.file_lock import locked_read_json_cli, locked_write_json_cli

logger = logging.getLogger(__name__)


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
    llm_warnings_count: int
    llm_warning_sample: str | None
    analysis_summary: str | None
    error: str | None
    created_at: str
    updated_at: str


class IntelligenceRunManager:
    def __init__(
        self,
        *,
        max_jobs: int = 64,
        jobs_path: str | Path = "data/intelligence/run_jobs.json",
    ) -> None:
        self._jobs: dict[str, IntelligenceRunJob] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs
        self._jobs_path = Path(jobs_path)
        self._jobs_path.parent.mkdir(parents=True, exist_ok=True)
        self._load_jobs()

    def _load_jobs(self) -> None:
        if not self._jobs_path.exists():
            return

        try:
            raw = locked_read_json_cli(self._jobs_path)
        except Exception as exc:
            logger.warning("Failed to load intelligence jobs from %s: %s", self._jobs_path, exc)
            return

        if not isinstance(raw, list):
            logger.warning("Invalid intelligence jobs format in %s", self._jobs_path)
            return

        now = _now_iso()
        recovered: list[IntelligenceRunJob] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                job = IntelligenceRunJob(
                    job_id=str(item.get("job_id", "")).strip(),
                    status=str(item.get("status", "error")).strip().lower(),
                    total_symbols=int(item.get("total_symbols", 0)),
                    completed_symbols=int(item.get("completed_symbols", 0)),
                    asof_date=str(item.get("asof_date")) if item.get("asof_date") else None,
                    opportunities_count=int(item.get("opportunities_count", 0)),
                    llm_warnings_count=int(item.get("llm_warnings_count", 0)),
                    llm_warning_sample=(
                        str(item.get("llm_warning_sample"))
                        if item.get("llm_warning_sample")
                        else None
                    ),
                    analysis_summary=(
                        str(item.get("analysis_summary"))
                        if item.get("analysis_summary")
                        else None
                    ),
                    error=str(item.get("error")) if item.get("error") else None,
                    created_at=str(item.get("created_at", now)),
                    updated_at=str(item.get("updated_at", now)),
                )
            except Exception:
                continue
            if not job.job_id:
                continue
            if job.status not in {"queued", "running", "completed", "error"}:
                job.status = "error"
                job.error = "Recovered invalid job status from disk."
                job.updated_at = now
            if job.status in {"queued", "running"}:
                job.status = "error"
                job.error = "Run interrupted by API restart."
                job.updated_at = now
            recovered.append(job)

        recovered.sort(key=lambda item: item.updated_at)
        if len(recovered) > self._max_jobs:
            recovered = recovered[-self._max_jobs :]

        with self._lock:
            for job in recovered:
                self._jobs[job.job_id] = job
            self._trim_jobs_locked()
            payload = self._build_jobs_payload_locked()

        self._persist_jobs(payload)

    def _build_jobs_payload_locked(self) -> list[dict]:
        jobs = sorted(self._jobs.values(), key=lambda item: item.updated_at)
        return [asdict(job) for job in jobs]

    def _persist_jobs(self, payload: list[dict]) -> None:
        try:
            locked_write_json_cli(self._jobs_path, payload)
        except Exception as exc:
            logger.warning("Failed to persist intelligence jobs to %s: %s", self._jobs_path, exc)

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
            llm_warnings_count=0,
            llm_warning_sample=None,
            analysis_summary=None,
            error=None,
            created_at=now,
            updated_at=now,
        )
        payload: list[dict]
        with self._lock:
            self._jobs[job_id] = job
            self._trim_jobs_locked()
            payload = self._build_jobs_payload_locked()
        self._persist_jobs(payload)

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
            events = list(getattr(snapshot, "events", []) or [])
            llm_warnings = [
                str(event.metadata.get("llm_error", "")).strip()
                for event in events
                if str(event.metadata.get("llm_error", "")).strip()
            ]
            self._update(
                job_id,
                status="completed",
                completed_symbols=len(snapshot.symbols),
                asof_date=snapshot.asof_date,
                opportunities_count=len(snapshot.opportunities),
                llm_warnings_count=len(llm_warnings),
                llm_warning_sample=(llm_warnings[0][:300] if llm_warnings else None),
                analysis_summary=build_intelligence_run_summary(
                    cfg=cfg,
                    snapshot=snapshot,
                    llm_warnings_count=len(llm_warnings),
                ),
                error=None,
            )
        except Exception as exc:
            self._update(
                job_id,
                status="error",
                completed_symbols=0,
                opportunities_count=0,
                llm_warnings_count=0,
                llm_warning_sample=None,
                analysis_summary=None,
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
        llm_warnings_count: int | None = None,
        llm_warning_sample: str | None = None,
        analysis_summary: str | None = None,
        error: str | None = None,
    ) -> None:
        payload: list[dict] | None = None
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
            if llm_warnings_count is not None:
                job.llm_warnings_count = llm_warnings_count
            job.llm_warning_sample = llm_warning_sample
            job.analysis_summary = analysis_summary
            job.error = error
            job.updated_at = _now_iso()
            payload = self._build_jobs_payload_locked()
        if payload is not None:
            self._persist_jobs(payload)

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
