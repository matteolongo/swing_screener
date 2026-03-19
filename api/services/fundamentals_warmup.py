"""Background fundamentals warmup jobs."""
from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
from datetime import datetime
import logging
from pathlib import Path
import threading
import uuid
from typing import Optional

from swing_screener.fundamentals import FundamentalsAnalysisService, FundamentalsConfig
from swing_screener.utils.file_lock import locked_read_json_cli, locked_write_json_cli

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


@dataclass
class FundamentalsWarmupJob:
    job_id: str
    status: str
    source: str
    force_refresh: bool
    total_symbols: int
    completed_symbols: int
    coverage_supported_count: int
    coverage_partial_count: int
    coverage_insufficient_count: int
    coverage_unsupported_count: int
    freshness_current_count: int
    freshness_stale_count: int
    freshness_unknown_count: int
    error_count: int
    last_completed_symbol: str | None
    error_sample: str | None
    created_at: str
    updated_at: str


class FundamentalsWarmupManager:
    def __init__(
        self,
        *,
        analysis_service: FundamentalsAnalysisService | None = None,
        max_jobs: int = 64,
        jobs_path: str | Path = "data/fundamentals/warmup_jobs.json",
    ) -> None:
        self._analysis_service = analysis_service or FundamentalsAnalysisService()
        self._jobs: dict[str, FundamentalsWarmupJob] = {}
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
            logger.warning("Failed to load fundamentals warmup jobs from %s: %s", self._jobs_path, exc)
            return

        if not isinstance(raw, list):
            logger.warning("Invalid fundamentals warmup jobs format in %s", self._jobs_path)
            return

        now = _now_iso()
        recovered: list[FundamentalsWarmupJob] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                job = FundamentalsWarmupJob(
                    job_id=str(item.get("job_id", "")).strip(),
                    status=str(item.get("status", "error")).strip().lower(),
                    source=str(item.get("source", "symbols")).strip().lower() or "symbols",
                    force_refresh=bool(item.get("force_refresh", False)),
                    total_symbols=int(item.get("total_symbols", 0)),
                    completed_symbols=int(item.get("completed_symbols", 0)),
                    coverage_supported_count=int(item.get("coverage_supported_count", 0)),
                    coverage_partial_count=int(item.get("coverage_partial_count", 0)),
                    coverage_insufficient_count=int(item.get("coverage_insufficient_count", 0)),
                    coverage_unsupported_count=int(item.get("coverage_unsupported_count", 0)),
                    freshness_current_count=int(item.get("freshness_current_count", 0)),
                    freshness_stale_count=int(item.get("freshness_stale_count", 0)),
                    freshness_unknown_count=int(item.get("freshness_unknown_count", 0)),
                    error_count=int(item.get("error_count", 0)),
                    last_completed_symbol=(
                        str(item.get("last_completed_symbol"))
                        if item.get("last_completed_symbol")
                        else None
                    ),
                    error_sample=str(item.get("error_sample")) if item.get("error_sample") else None,
                    created_at=str(item.get("created_at", now)),
                    updated_at=str(item.get("updated_at", now)),
                )
            except Exception:
                continue
            if not job.job_id:
                continue
            if job.status not in {"queued", "running", "completed", "error"}:
                job.status = "error"
                job.error_sample = "Recovered invalid fundamentals warmup job status from disk."
                job.updated_at = now
            if job.status in {"queued", "running"}:
                job.status = "error"
                job.error_sample = "Fundamentals warmup interrupted by API restart."
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
            logger.warning("Failed to persist fundamentals warmup jobs to %s: %s", self._jobs_path, exc)

    def _trim_jobs_locked(self) -> None:
        if len(self._jobs) <= self._max_jobs:
            return
        ordered = sorted(self._jobs.values(), key=lambda item: item.updated_at)
        for job in ordered[: len(self._jobs) - self._max_jobs]:
            self._jobs.pop(job.job_id, None)

    def start_job(
        self,
        *,
        symbols: list[str],
        source: str,
        force_refresh: bool,
        cfg: FundamentalsConfig,
    ) -> Optional[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for symbol in symbols:
            text = str(symbol).strip().upper()
            if not text or text in seen:
                continue
            seen.add(text)
            cleaned.append(text)
        if not cleaned:
            return None

        now = _now_iso()
        job_id = uuid.uuid4().hex
        job = FundamentalsWarmupJob(
            job_id=job_id,
            status="queued",
            source=source,
            force_refresh=force_refresh,
            total_symbols=len(cleaned),
            completed_symbols=0,
            coverage_supported_count=0,
            coverage_partial_count=0,
            coverage_insufficient_count=0,
            coverage_unsupported_count=0,
            freshness_current_count=0,
            freshness_stale_count=0,
            freshness_unknown_count=0,
            error_count=0,
            last_completed_symbol=None,
            error_sample=None,
            created_at=now,
            updated_at=now,
        )
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
                "force_refresh": force_refresh,
            },
            daemon=True,
        )
        worker.start()
        return job_id

    def get_job(self, job_id: str) -> Optional[FundamentalsWarmupJob]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            return FundamentalsWarmupJob(**job.__dict__)

    def _run_job(
        self,
        *,
        job_id: str,
        symbols: list[str],
        cfg: FundamentalsConfig,
        force_refresh: bool,
    ) -> None:
        self._update(job_id, status="running")
        try:
            for symbol in symbols:
                try:
                    snapshot = self._analysis_service.get_snapshot(
                        symbol,
                        cfg=cfg,
                        force_refresh=force_refresh,
                    )
                    updates = self._counts_for_snapshot(snapshot)
                    updates["completed_symbols"] = 1
                    updates["last_completed_symbol"] = symbol
                    if getattr(snapshot, "error", None):
                        updates["error_sample"] = str(snapshot.error)
                    self._increment(job_id, **updates)
                except Exception as exc:
                    self._increment(
                        job_id,
                        completed_symbols=1,
                        error_count=1,
                        last_completed_symbol=symbol,
                        error_sample=str(exc),
                    )
            self._update(job_id, status="completed")
        except Exception as exc:
            self._update(job_id, status="error", error_sample=str(exc))

    def _counts_for_snapshot(self, snapshot) -> dict[str, int]:
        coverage_status = str(getattr(snapshot, "coverage_status", "insufficient")).strip().lower()
        freshness_status = str(getattr(snapshot, "freshness_status", "unknown")).strip().lower()
        updates: dict[str, int] = {
            "coverage_supported_count": 1 if coverage_status == "supported" else 0,
            "coverage_partial_count": 1 if coverage_status == "partial" else 0,
            "coverage_insufficient_count": 1 if coverage_status == "insufficient" else 0,
            "coverage_unsupported_count": 1 if coverage_status == "unsupported" else 0,
            "freshness_current_count": 1 if freshness_status == "current" else 0,
            "freshness_stale_count": 1 if freshness_status == "stale" else 0,
            "freshness_unknown_count": 1 if freshness_status == "unknown" else 0,
            "error_count": 1 if getattr(snapshot, "error", None) else 0,
        }
        return updates

    def _increment(self, job_id: str, **increments: int | str | None) -> None:
        payload: list[dict]
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            for field_name, increment in increments.items():
                if field_name in {"last_completed_symbol", "error_sample"}:
                    if increment:
                        setattr(job, field_name, str(increment))
                    continue
                current = int(getattr(job, field_name, 0))
                setattr(job, field_name, current + int(increment or 0))
            job.updated_at = _now_iso()
            payload = self._build_jobs_payload_locked()
        self._persist_jobs(payload)

    def _update(
        self,
        job_id: str,
        *,
        status: str | None = None,
        error_sample: str | None = None,
    ) -> None:
        payload: list[dict]
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            if error_sample:
                job.error_sample = str(error_sample)
            job.updated_at = _now_iso()
            payload = self._build_jobs_payload_locked()
        self._persist_jobs(payload)


_fundamentals_warmup_manager: FundamentalsWarmupManager | None = None
_fundamentals_warmup_lock = threading.Lock()


def get_fundamentals_warmup_manager() -> FundamentalsWarmupManager:
    global _fundamentals_warmup_manager
    if _fundamentals_warmup_manager is None:
        with _fundamentals_warmup_lock:
            if _fundamentals_warmup_manager is None:
                _fundamentals_warmup_manager = FundamentalsWarmupManager()
    return _fundamentals_warmup_manager
