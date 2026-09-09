"""Apply canonical lifecycle commands to isolated browser-owned snapshots."""

from __future__ import annotations

from datetime import timedelta

import pandas as pd

from api.models.portfolio import (
    TradingMarketPrice,
    TradingStateCommandRequest,
    TradingStateCommandResponse,
)
from api.repositories.config_repo import ConfigRepository
from api.repositories.in_memory_trading_state import InMemoryTradingState
from api.repositories.strategy_repo import StrategyRepository
from api.services.order_approval_token import OrderApprovalTokenSigner
from api.services.orders_service import OrdersService
from api.services.portfolio_service import PortfolioService
from swing_screener.errors import ConflictError, UnprocessableError


class _CommandPriceProvider:
    """Adapt one validated observation to the canonical stop service's provider."""

    def __init__(self, observation: TradingMarketPrice | None) -> None:
        self._observation = observation

    def fetch_ohlcv(self, tickers, **kwargs) -> pd.DataFrame:
        del kwargs
        observation = self._observation
        if observation is None or tickers != [observation.ticker]:
            raise ValueError("No matching command price observation")
        return pd.DataFrame(
            [[observation.price]],
            columns=pd.MultiIndex.from_tuples([("Close", observation.ticker)]),
            index=pd.DatetimeIndex([observation.observed_at]),
        )


class StatelessTradingService:
    """One command-local unit of work; no server portfolio or idempotency writes.

    The supplied strategy is round-tripped as browser state. Approval policy and
    signed-token identity use the configured backend strategy, just as persisted
    orders do; browser state cannot relax those rules.
    """

    def __init__(
        self,
        config_repo: ConfigRepository,
        strategy_repo: StrategyRepository,
        approval_signer: OrderApprovalTokenSigner,
    ) -> None:
        self._config_repo = config_repo
        self._strategy_repo = strategy_repo
        self._approval_signer = approval_signer

    def execute(
        self, request: TradingStateCommandRequest
    ) -> TradingStateCommandResponse:
        if request.expected_revision != request.snapshot.revision:
            raise ConflictError(
                f"expected revision {request.expected_revision}, "
                f"current revision is {request.snapshot.revision}"
            )
        state = InMemoryTradingState(request.snapshot)
        context = request.context
        command = request.command
        if command.operation == "update_stop":
            observation = context.market_price
            assert observation is not None  # Required by the command envelope.
            position = state.positions_repo.get_position(command.payload.position_id)
            if position is not None and observation.ticker != position["ticker"]:
                raise UnprocessableError("market_price ticker must match the position")
            age = context.effective_at - observation.observed_at
            maximum_age = timedelta(
                days=self._config_repo.get().portfolio_snapshot_stale_after_days
            )
            if age < timedelta(0) or age > maximum_age:
                raise UnprocessableError(
                    "market_price observation is future-dated or stale"
                )
        if command.operation == "fill_order":
            order = state.orders_repo.get_order(command.payload.order_id)
            if (
                order is not None
                and not order.get("position_id")
                and context.new_position_id is not None
                and state.positions_repo.get_position(context.new_position_id)
            ):
                raise ConflictError("new_position_id already exists in the snapshot")

        def business_date() -> str:
            return context.effective_at.date().isoformat()

        def position_id() -> str:
            if context.new_position_id is None:
                raise UnprocessableError(
                    "new_position_id is required for an entry fill"
                )
            return context.new_position_id

        orders = OrdersService(
            orders_repo=state.orders_repo,
            positions_repo=state.positions_repo,
            config_repo=self._config_repo,
            strategy_repo=self._strategy_repo,
            approval_signer=self._approval_signer,
            business_date=business_date,
            position_id_factory=position_id,
        )
        affected_orders: list[str] = []
        affected_positions: list[str] = []
        if command.operation == "create_order":
            order = orders.create_order(command.payload)
            affected_orders.append(order["order_id"])
        elif command.operation == "submit_order":
            orders.submit_order(command.payload.order_id)
            affected_orders.append(command.payload.order_id)
        elif command.operation == "cancel_order":
            orders.cancel_order(command.payload.order_id)
            affected_orders.append(command.payload.order_id)
        elif command.operation == "fill_order":
            result = orders.fill_order(command.payload.order_id, command.payload)
            affected_orders.append(result.order_id)
            affected_positions.append(result.position.position_id)
        else:
            portfolio = PortfolioService(
                positions_repo=state.positions_repo,
                config_repo=self._config_repo,
                provider=_CommandPriceProvider(context.market_price),
                business_date=business_date,
            )
            if command.operation == "update_stop":
                portfolio.update_position_stop(
                    command.payload.position_id, command.payload
                )
            elif command.operation == "partial_close":
                portfolio.partial_close_position(
                    command.payload.position_id, command.payload
                )
            elif command.operation == "close_position":
                portfolio.close_position(command.payload.position_id, command.payload)
            else:
                raise UnprocessableError("Unsupported trading command")
            affected_positions.append(command.payload.position_id)
        return state.commit(
            expected_revision=request.expected_revision,
            affected_order_ids=affected_orders,
            affected_position_ids=affected_positions,
        )
