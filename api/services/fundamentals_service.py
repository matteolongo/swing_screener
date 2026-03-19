"""Fundamentals service."""
from __future__ import annotations

from fastapi import HTTPException

from api.models.fundamentals import (
    FundamentalRefreshRequest,
    FundamentalSnapshotResponse,
    FundamentalsCompareRequest,
    FundamentalsCompareResponse,
    FundamentalsConfigModel,
    FundamentalsWarmupLaunchResponse,
    FundamentalsWarmupRequest,
    FundamentalsWarmupStatusResponse,
)
from api.repositories.fundamentals_config_repo import FundamentalsConfigRepository
from api.repositories.watchlist_repo import WatchlistRepository
from api.services.fundamentals_warmup import FundamentalsWarmupManager, get_fundamentals_warmup_manager
from swing_screener.fundamentals import FundamentalsAnalysisService, build_fundamentals_config


class FundamentalsService:
    def __init__(
        self,
        *,
        config_repo: FundamentalsConfigRepository | None = None,
        analysis_service: FundamentalsAnalysisService | None = None,
        watchlist_repo: WatchlistRepository | None = None,
        warmup_manager: FundamentalsWarmupManager | None = None,
    ) -> None:
        self._config_repo = config_repo or FundamentalsConfigRepository()
        self._analysis_service = analysis_service or FundamentalsAnalysisService()
        self._watchlist_repo = watchlist_repo
        self._warmup_manager = warmup_manager or get_fundamentals_warmup_manager()

    def _normalize_config(self, raw_payload: dict | None = None) -> FundamentalsConfigModel:
        cfg = build_fundamentals_config(raw_payload or {})
        return FundamentalsConfigModel.model_validate(
            {
                "enabled": cfg.enabled,
                "providers": list(cfg.providers),
                "cache_ttl_hours": cfg.cache_ttl_hours,
                "stale_after_days": cfg.stale_after_days,
                "compare_limit": cfg.compare_limit,
            }
        )

    def get_config(self) -> FundamentalsConfigModel:
        return self._normalize_config(self._config_repo.load_raw())

    def update_config(self, payload: FundamentalsConfigModel) -> FundamentalsConfigModel:
        normalized = self._normalize_config(payload.model_dump())
        self._config_repo.save_raw(normalized.model_dump())
        return normalized

    def _build_cfg(self):
        return build_fundamentals_config(self.get_config().model_dump())

    def _serialize_warmup_job_status(self, job) -> FundamentalsWarmupStatusResponse:
        return FundamentalsWarmupStatusResponse.model_validate(
            {
                "job_id": job.job_id,
                "status": job.status,
                "source": job.source,
                "force_refresh": job.force_refresh,
                "total_symbols": job.total_symbols,
                "completed_symbols": job.completed_symbols,
                "coverage_counts": {
                    "supported": job.coverage_supported_count,
                    "partial": job.coverage_partial_count,
                    "insufficient": job.coverage_insufficient_count,
                    "unsupported": job.coverage_unsupported_count,
                },
                "freshness_counts": {
                    "current": job.freshness_current_count,
                    "stale": job.freshness_stale_count,
                    "unknown": job.freshness_unknown_count,
                },
                "error_count": job.error_count,
                "last_completed_symbol": job.last_completed_symbol,
                "error_sample": job.error_sample,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
            }
        )

    def get_snapshot(self, symbol: str, *, force_refresh: bool = False) -> FundamentalSnapshotResponse:
        cfg = self._build_cfg()
        snapshot = self._analysis_service.get_snapshot(symbol, cfg=cfg, force_refresh=force_refresh)
        return FundamentalSnapshotResponse.model_validate(snapshot.to_dict())

    def refresh_snapshot(self, request: FundamentalRefreshRequest) -> FundamentalSnapshotResponse:
        return self.get_snapshot(request.symbol, force_refresh=True)

    def compare(self, request: FundamentalsCompareRequest) -> FundamentalsCompareResponse:
        cfg = self._build_cfg()
        snapshots = self._analysis_service.compare_symbols(
            request.symbols,
            cfg=cfg,
            force_refresh=request.force_refresh,
        )
        return FundamentalsCompareResponse(
            snapshots=[FundamentalSnapshotResponse.model_validate(snapshot.to_dict()) for snapshot in snapshots]
        )

    def start_warmup(self, request: FundamentalsWarmupRequest) -> FundamentalsWarmupLaunchResponse:
        if request.source == "watchlist":
            if self._watchlist_repo is None:
                raise HTTPException(status_code=500, detail="Watchlist repository is not available.")
            symbols = [item.ticker for item in self._watchlist_repo.list_items()]
        else:
            symbols = list(request.symbols)

        if not symbols:
            raise HTTPException(status_code=400, detail="No symbols available for fundamentals warmup.")

        job_id = self._warmup_manager.start_job(
            symbols=symbols,
            source=request.source,
            force_refresh=request.force_refresh,
            cfg=self._build_cfg(),
        )
        if not job_id:
            raise HTTPException(status_code=400, detail="No valid symbols available for fundamentals warmup.")

        job = self._warmup_manager.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=500, detail="Failed to create fundamentals warmup job.")

        return FundamentalsWarmupLaunchResponse.model_validate(
            {
                "job_id": job.job_id,
                "status": job.status,
                "source": job.source,
                "force_refresh": job.force_refresh,
                "total_symbols": job.total_symbols,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
            }
        )

    def get_warmup_status(self, job_id: str) -> FundamentalsWarmupStatusResponse:
        job = self._warmup_manager.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Fundamentals warmup job not found.")
        return self._serialize_warmup_job_status(job)
