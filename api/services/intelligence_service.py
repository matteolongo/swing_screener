"""Market intelligence service."""
from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from fastapi import HTTPException

from api.models.intelligence import (
    IntelligenceOpportunityResponse,
    IntelligenceOpportunitiesResponse,
    IntelligenceRunLaunchResponse,
    IntelligenceRunRequest,
    IntelligenceRunStatusResponse,
)
from api.repositories.strategy_repo import StrategyRepository
from api.services.intelligence_warmup import get_intelligence_run_manager
from swing_screener.intelligence.config import build_intelligence_config
from swing_screener.intelligence.storage import IntelligenceStorage


class IntelligenceService:
    def __init__(self, strategy_repo: StrategyRepository, storage_root: str | Path = "data/intelligence") -> None:
        self._strategy_repo = strategy_repo
        self._storage = IntelligenceStorage(root_dir=storage_root)

    def start_run(self, request: IntelligenceRunRequest) -> IntelligenceRunLaunchResponse:
        strategy = self._strategy_repo.get_active_strategy()
        cfg = build_intelligence_config(strategy)

        if request.providers:
            cfg = replace(cfg, providers=tuple(str(provider).strip().lower() for provider in request.providers if str(provider).strip()))
        if request.lookback_hours is not None:
            cfg = replace(cfg, catalyst=replace(cfg.catalyst, lookback_hours=request.lookback_hours))
        if request.max_opportunities is not None:
            cfg = replace(
                cfg,
                opportunity=replace(cfg.opportunity, max_daily_opportunities=request.max_opportunities),
            )

        technical = None
        if request.technical_readiness:
            technical = {
                str(symbol).strip().upper(): float(value)
                for symbol, value in request.technical_readiness.items()
                if str(symbol).strip()
            }

        job_id = get_intelligence_run_manager().start_job(
            symbols=request.symbols,
            cfg=cfg,
            technical_readiness=technical,
        )
        if job_id is None:
            raise HTTPException(status_code=400, detail="No valid symbols provided for intelligence run.")

        job = get_intelligence_run_manager().get_job(job_id)
        if job is None:
            raise HTTPException(status_code=500, detail="Failed to start intelligence run.")
        return IntelligenceRunLaunchResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            total_symbols=job.total_symbols,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def get_run_status(self, job_id: str) -> IntelligenceRunStatusResponse:
        job = get_intelligence_run_manager().get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Intelligence run job not found: {job_id}")
        return IntelligenceRunStatusResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            total_symbols=job.total_symbols,
            completed_symbols=job.completed_symbols,
            asof_date=job.asof_date,
            opportunities_count=job.opportunities_count,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def get_opportunities(
        self,
        asof_date: str | None = None,
        symbols: list[str] | None = None,
    ) -> IntelligenceOpportunitiesResponse:
        target_date = asof_date or self._storage.latest_opportunities_date()
        if target_date is None:
            raise HTTPException(status_code=404, detail="No intelligence opportunities available.")
        opportunities = self._storage.load_opportunities(target_date)
        if symbols:
            symbol_set = {str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()}
            opportunities = [opportunity for opportunity in opportunities if opportunity.symbol in symbol_set]
        payload = [
            IntelligenceOpportunityResponse(
                symbol=opportunity.symbol,
                technical_readiness=opportunity.technical_readiness,
                catalyst_strength=opportunity.catalyst_strength,
                opportunity_score=opportunity.opportunity_score,
                state=opportunity.state,
                explanations=opportunity.explanations,
            )
            for opportunity in opportunities
        ]
        return IntelligenceOpportunitiesResponse(asof_date=target_date, opportunities=payload)
