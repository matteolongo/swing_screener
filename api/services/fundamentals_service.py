"""Fundamentals service."""
from __future__ import annotations

import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)

from api.models.fundamentals import (
    DegiroAuditRecordResponse,
    DegiroCapabilityAuditRequest,
    DegiroCapabilityAuditResponse,
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

    def run_degiro_capability_audit(
        self, request: DegiroCapabilityAuditRequest
    ) -> DegiroCapabilityAuditResponse:
        import importlib.util

        # Lazy-import check: raise 503 if degiro-connector not installed
        if importlib.util.find_spec("degiro_connector") is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "degiro-connector is not installed. "
                    "Install it with: pip install -e '.[degiro]'"
                ),
            )

        # Credentials check
        try:
            from swing_screener.integrations.degiro.credentials import load_credentials
            credentials = load_credentials()
        except ValueError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        from swing_screener.integrations.degiro.audit import run_capability_audit
        from swing_screener.integrations.degiro.client import DegiroClient
        from swing_screener.integrations.degiro.storage import save_audit_run
        from swing_screener.settings import data_dir, get_settings_manager

        artifact_base = get_settings_manager().resolve_runtime_path(
            "degiro_capability_audits_dir",
            data_dir() / "degiro" / "capability_audits",
        )

        with DegiroClient(credentials) as client:
            run = run_capability_audit(
                client,
                request.symbols,
                include_quotes=request.include_quotes,
                include_news=request.include_news,
                include_agenda=request.include_agenda,
            )

        artifact_paths = save_audit_run(run, artifact_base)

        results = [
            DegiroAuditRecordResponse(
                product_id=r.product_id,
                isin=r.isin,
                vwd_id=r.vwd_id,
                name=r.name,
                exchange=r.exchange,
                currency=r.currency,
                symbol=r.symbol,
                has_quote=r.has_quote,
                has_chart=r.has_chart,
                has_profile=r.has_profile,
                has_ratios=r.has_ratios,
                has_statements=r.has_statements,
                has_estimates=r.has_estimates,
                has_agenda=r.has_agenda,
                has_news=r.has_news,
                resolution_confidence=r.resolution_confidence,
                resolution_notes=r.resolution_notes,
            )
            for r in run.results
        ]

        return DegiroCapabilityAuditResponse(
            audit_id=run.audit_id,
            created_at=run.created_at,
            symbols=list(run.symbols),
            summary_counts=run.summary_counts,
            artifact_paths=artifact_paths,
            results=results,
        )

    def run_degiro_portfolio_audit(
        self,
        *,
        include_quotes: bool = True,
        include_news: bool = True,
        include_agenda: bool = True,
    ) -> DegiroCapabilityAuditResponse:
        """Audit all products in the live DeGiro portfolio (no text search required)."""
        import importlib.util

        if importlib.util.find_spec("degiro_connector") is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "degiro-connector is not installed. "
                    "Install it with: pip install -e '.[degiro]'"
                ),
            )

        try:
            from swing_screener.integrations.degiro.credentials import load_credentials
            credentials = load_credentials()
        except ValueError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        from swing_screener.integrations.degiro.audit import run_portfolio_capability_audit
        from swing_screener.integrations.degiro.client import DegiroClient
        from swing_screener.integrations.degiro.storage import save_audit_run
        from swing_screener.settings import data_dir, get_settings_manager

        artifact_base = get_settings_manager().resolve_runtime_path(
            "degiro_capability_audits_dir",
            data_dir() / "degiro" / "capability_audits",
        )

        with DegiroClient(credentials) as client:
            run = run_portfolio_capability_audit(
                client,
                include_quotes=include_quotes,
                include_news=include_news,
                include_agenda=include_agenda,
            )

        artifact_paths = save_audit_run(run, artifact_base)

        # Update the ISIN map so DegiroFundamentalsProvider can resolve these symbols
        try:
            from swing_screener.fundamentals.providers.degiro import update_isin_map_from_audit
            update_isin_map_from_audit([
                {"symbol": r.symbol, "isin": r.isin}
                for r in run.results
                if r.isin
            ])
        except Exception:
            logger.warning("Failed to update ISIN map from portfolio audit", exc_info=True)

        results = [
            DegiroAuditRecordResponse(
                product_id=r.product_id,
                isin=r.isin,
                vwd_id=r.vwd_id,
                name=r.name,
                exchange=r.exchange,
                currency=r.currency,
                symbol=r.symbol,
                has_quote=r.has_quote,
                has_chart=r.has_chart,
                has_profile=r.has_profile,
                has_ratios=r.has_ratios,
                has_statements=r.has_statements,
                has_estimates=r.has_estimates,
                has_agenda=r.has_agenda,
                has_news=r.has_news,
                resolution_confidence=r.resolution_confidence,
                resolution_notes=r.resolution_notes,
            )
            for r in run.results
        ]

        return DegiroCapabilityAuditResponse(
            audit_id=run.audit_id,
            created_at=run.created_at,
            symbols=list(run.symbols),
            summary_counts=run.summary_counts,
            artifact_paths=artifact_paths,
            results=results,
        )
