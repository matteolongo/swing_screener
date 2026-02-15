"""Background social analysis warmup jobs."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import threading
import uuid
from typing import Optional

from swing_screener.social.analysis import analyze_social_symbol


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


@dataclass
class SocialWarmupJob:
    job_id: str
    status: str
    total_symbols: int
    completed_symbols: int
    ok_symbols: int
    no_data_symbols: int
    error_symbols: int
    created_at: str
    updated_at: str


class SocialWarmupManager:
    def __init__(self, *, max_jobs: int = 64) -> None:
        self._jobs: dict[str, SocialWarmupJob] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs

    def start_job(
        self,
        *,
        symbols: list[str],
        lookback_hours: int,
        min_sample_size: int,
        providers: list[str],
        sentiment_analyzer: str,
        max_events: int = 100,
    ) -> Optional[str]:
        cleaned_symbols = []
        seen: set[str] = set()
        for symbol in symbols:
            normalized = str(symbol).strip().upper()
            if normalized and normalized not in seen:
                seen.add(normalized)
                cleaned_symbols.append(normalized)
        if not cleaned_symbols:
            return None

        now = _now_iso()
        job_id = uuid.uuid4().hex
        job = SocialWarmupJob(
            job_id=job_id,
            status="queued",
            total_symbols=len(cleaned_symbols),
            completed_symbols=0,
            ok_symbols=0,
            no_data_symbols=0,
            error_symbols=0,
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
                "symbols": cleaned_symbols,
                "lookback_hours": lookback_hours,
                "min_sample_size": min_sample_size,
                "providers": providers,
                "sentiment_analyzer": sentiment_analyzer,
                "max_events": max_events,
            },
            daemon=True,
        )
        worker.start()
        return job_id

    def get_job(self, job_id: str) -> Optional[SocialWarmupJob]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            return SocialWarmupJob(**job.__dict__)

    def _run_job(
        self,
        *,
        job_id: str,
        symbols: list[str],
        lookback_hours: int,
        min_sample_size: int,
        providers: list[str],
        sentiment_analyzer: str,
        max_events: int,
    ) -> None:
        self._update_job(job_id, status="running")
        for symbol in symbols:
            status = "error"
            try:
                result = analyze_social_symbol(
                    symbol,
                    lookback_hours=lookback_hours,
                    min_sample_size=min_sample_size,
                    provider_names=providers,
                    sentiment_analyzer_name=sentiment_analyzer,
                    max_events=max_events,
                )
                status = str(result.get("status", "error"))
            except Exception:
                status = "error"

            self._increment_job(job_id, result_status=status)

        self._update_job(job_id, status="completed")

    def _update_job(self, job_id: str, *, status: Optional[str] = None) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            job.updated_at = _now_iso()

    def _increment_job(self, job_id: str, *, result_status: str) -> None:
        normalized = str(result_status).strip().lower()
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.completed_symbols += 1
            if normalized == "ok":
                job.ok_symbols += 1
            elif normalized == "no_data":
                job.no_data_symbols += 1
            else:
                job.error_symbols += 1
            job.updated_at = _now_iso()

    def _trim_jobs_locked(self) -> None:
        if len(self._jobs) <= self._max_jobs:
            return
        sorted_jobs = sorted(self._jobs.values(), key=lambda item: item.updated_at)
        to_remove = len(self._jobs) - self._max_jobs
        for item in sorted_jobs[:to_remove]:
            self._jobs.pop(item.job_id, None)


_MANAGER = SocialWarmupManager()


def get_social_warmup_manager() -> SocialWarmupManager:
    return _MANAGER

