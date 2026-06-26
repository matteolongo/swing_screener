"""Portfolio service - positions and local order management."""
from __future__ import annotations

from typing import Optional

import pandas as pd

from api.models.portfolio import (
    ClosePositionRequest,
    CreatePositionRequest,
    EarningsProximityResponse,
    PartialCloseRequest,
    Position,
    PositionMetrics,
    PositionUpdate,
    PositionsWithMetricsResponse,
    PortfolioSummary,
    UpdateStopRequest,
    UpdateTrailMethodRequest,
)
from api.repositories.config_repo import ConfigRepository
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio import (
    PositionPricingService,
    PortfolioReadService,
    PortfolioWriteService,
    PositionStopAdvisor,
)
from swing_screener.data.providers import MarketDataProvider, get_default_provider

# Re-export module-level symbols accessed by tests
from api.services.portfolio.pricing import _eurusd_cache, _earnings_cache  # noqa: F401
from api.services.portfolio.read import _compute_r_fx_adjusted  # noqa: F401


class PortfolioService:
    def __init__(
        self,
        positions_repo: PositionsRepository,
        provider: Optional[MarketDataProvider] = None,
        config_repo: Optional[ConfigRepository] = None,
    ) -> None:
        self._positions_repo = positions_repo
        self._provider = provider or get_default_provider()
        self._config_repo = config_repo or ConfigRepository()

        self._pricing = PositionPricingService(self._provider)
        self._read = PortfolioReadService(self._positions_repo, self._pricing, self._config_repo)
        self._write = PortfolioWriteService(self._positions_repo, self._provider)
        self._advisor = PositionStopAdvisor(self._positions_repo, self._provider, self._config_repo)

    def fetch_recent_ohlcv(self, ticker: str, *, lookback_days: int = 400) -> pd.DataFrame:
        return self._pricing.fetch_recent_ohlcv(ticker, lookback_days=lookback_days)

    def list_positions(
        self,
        status: Optional[str] = None,
        *,
        time_stop_days: int | None = None,
        time_stop_min_r: float | None = None,
    ) -> PositionsWithMetricsResponse:
        return self._read.list_positions(status=status, time_stop_days=time_stop_days, time_stop_min_r=time_stop_min_r)

    def get_position(self, position_id: str) -> Position:
        return self._read.get_position(position_id)

    def get_position_metrics(self, position_id: str) -> PositionMetrics:
        return self._read.get_position_metrics(position_id)

    def get_portfolio_summary(self, account_size: float, account_size_mode: str = "equity") -> PortfolioSummary:
        return self._read.get_portfolio_summary(account_size, account_size_mode)

    def get_earnings_proximity(self, ticker: str) -> EarningsProximityResponse:
        return self._pricing.get_earnings_proximity(ticker)

    def create_position(self, request: CreatePositionRequest) -> Position:
        return self._write.create_position(request)

    def update_position_stop(self, position_id: str, request: UpdateStopRequest) -> dict:
        return self._write.update_position_stop(position_id, request)

    def close_position(self, position_id: str, request: ClosePositionRequest) -> dict:
        return self._write.close_position(position_id, request)

    def partial_close_position(self, position_id: str, request: PartialCloseRequest) -> dict:
        return self._write.partial_close_position(position_id, request)

    def update_trail_method(self, position_id: str, request: UpdateTrailMethodRequest) -> dict:
        return self._write.update_trail_method(position_id, request)

    def compute_position_stop_suggestion(
        self,
        position_payload: dict,
        manage_payload: Optional[dict] = None,
    ) -> PositionUpdate:
        return self._advisor.compute_position_stop_suggestion(position_payload, manage_payload)

    def suggest_position_stop(self, position_id: str) -> PositionUpdate:
        return self._advisor.suggest_position_stop(position_id)

    def suggest_stop_intraday(
        self,
        position_id: str,
        price: Optional[float] = None,
    ) -> PositionUpdate:
        return self._advisor.suggest_stop_intraday(position_id, price)
