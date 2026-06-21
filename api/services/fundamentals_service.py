"""Fundamentals service."""
from __future__ import annotations

from api.models.fundamentals import (
    FundamentalRefreshRequest,
    FundamentalSnapshotResponse,
    FundamentalsConfigModel,
)
from api.repositories.fundamentals_config_repo import FundamentalsConfigRepository
from swing_screener.fundamentals import FundamentalsAnalysisService, build_fundamentals_config


class FundamentalsService:
    def __init__(
        self,
        *,
        config_repo: FundamentalsConfigRepository | None = None,
        analysis_service: FundamentalsAnalysisService | None = None,
    ) -> None:
        self._config_repo = config_repo or FundamentalsConfigRepository()
        self._analysis_service = analysis_service or FundamentalsAnalysisService()

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

    def _get_config(self) -> FundamentalsConfigModel:
        return self._normalize_config(self._config_repo.load_raw())

    def _build_cfg(self):
        return build_fundamentals_config(self._get_config().model_dump())

    def get_snapshot(self, symbol: str, *, force_refresh: bool = False) -> FundamentalSnapshotResponse:
        cfg = self._build_cfg()
        snapshot = self._analysis_service.get_snapshot(symbol, cfg=cfg, force_refresh=force_refresh)
        return FundamentalSnapshotResponse.model_validate(snapshot.to_dict())

    def refresh_snapshot(self, request: FundamentalRefreshRequest) -> FundamentalSnapshotResponse:
        return self.get_snapshot(request.symbol, force_refresh=True)
