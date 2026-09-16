"""Apply canonical lifecycle commands to isolated browser-owned snapshots."""

from __future__ import annotations

from datetime import timedelta

import pandas as pd

from api.models.portfolio import (
    ClosePositionRequest,
    PartialCloseRequest,
    TradingMarketPrice,
    TradingStateCommandRequest,
    TradingStateCommandResponse,
)
from api.repositories.config_repo import ConfigRepository
from api.repositories.in_memory_trading_state import InMemoryTradingState
from api.repositories.strategy_repo import StrategyRepository
from api.services.order_approval_token import OrderApprovalTokenSigner
from api.services.orders_service import OrdersService, linked_stop_order_id
from api.services.portfolio_service import PortfolioService
from swing_screener.errors import ConflictError, UnprocessableError


def _session_adjusted_age(effective_at, observed_at) -> timedelta:
    """Age of a daily-candle observation measured in completed sessions.

    US equities trade no daily session on Saturday/Sunday, so a weekend
    command still sees Friday's bar as the latest completed session. Map a
    weekend effective time back to Friday end-of-day before differencing;
    weekdays (and holidays, which have no calendar here) keep raw age.
    """
    reference = effective_at
    if reference.weekday() == 5:  # Saturday
        reference = (reference - timedelta(days=1)).replace(
            hour=23, minute=59, second=59, microsecond=0
        )
    elif reference.weekday() == 6:  # Sunday
        reference = (reference - timedelta(days=2)).replace(
            hour=23, minute=59, second=59, microsecond=0
        )
    return reference - observed_at


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
            age = _session_adjusted_age(context.effective_at, observation.observed_at)
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
            order = state.orders_repo.get_order(command.payload.order_id)
            if order is not None and order.get("order_kind") != "entry":
                if order.get("status") not in ("pending", "submitted"):
                    raise ConflictError(
                        f"Order {command.payload.order_id} is already {order.get('status')}"
                    )
                position_id = order.get("position_id")
                position = state.positions_repo.get_position(position_id)
                if position is None:
                    raise UnprocessableError("Exit order must reference an open position")
                if order.get("ticker") != position.get("ticker"):
                    raise UnprocessableError("Exit order ticker must match the position")
                quantity = int(order["quantity"])
                shares = int(position["shares"])
                if quantity > shares:
                    raise UnprocessableError("Exit order quantity exceeds position shares")
                portfolio = PortfolioService(
                    positions_repo=state.positions_repo,
                    config_repo=self._config_repo,
                    provider=_CommandPriceProvider(context.market_price),
                    business_date=lambda: command.payload.filled_date,
                )
                if quantity == shares:
                    portfolio.close_position(
                        position_id,
                        ClosePositionRequest(
                            exit_price=command.payload.filled_price,
                            fee_eur=command.payload.fee_eur,
                            exit_fx_rate=command.payload.fill_fx_rate,
                        ),
                    )
                else:
                    portfolio.partial_close_position(
                        position_id,
                        PartialCloseRequest(
                            shares_closed=quantity,
                            price=command.payload.filled_price,
                            fee_eur=command.payload.fee_eur,
                            fx_rate=command.payload.fill_fx_rate,
                        ),
                    )
                state.orders_repo.update_order(
                    command.payload.order_id,
                    {
                        "status": "filled",
                        "entry_price": command.payload.filled_price,
                        "filled_date": command.payload.filled_date,
                        "fee_eur": command.payload.fee_eur,
                        "fill_fx_rate": command.payload.fill_fx_rate,
                    },
                )
                affected_orders.append(command.payload.order_id)
                affected_positions.append(position_id)
            else:
                result = orders.fill_order(command.payload.order_id, command.payload)
                affected_orders.append(result.order_id)
                affected_positions.append(result.position.position_id)
                linked_id = linked_stop_order_id(result.position.position_id)
                if (
                    linked_id not in affected_orders
                    and state.orders_repo.get_order(linked_id) is not None
                ):
                    affected_orders.append(linked_id)
        else:
            portfolio = PortfolioService(
                positions_repo=state.positions_repo,
                config_repo=self._config_repo,
                provider=_CommandPriceProvider(context.market_price),
                business_date=business_date,
            )
            if command.operation == "update_stop":
                position_id = command.payload.position_id
                old_position = state.positions_repo.get_position(position_id)
                old_stop = old_position.get("stop_price") if old_position else None
                portfolio.update_position_stop(position_id, command.payload)
                updated = state.positions_repo.get_position(position_id)
                assert updated is not None
                linked = orders.sync_linked_stop_order(
                    position_id=position_id,
                    ticker=str(updated.get("ticker")),
                    shares=int(updated.get("shares")),
                    stop_price=float(updated.get("stop_price")),
                    business_date=business_date(),
                    parent_order_id=updated.get("source_order_id"),
                    notes=(
                        "Auto-created from position stop update (was "
                        f"{old_stop})"
                    ),
                    quote_currency=updated.get("quote_currency"),
                    account_currency=updated.get("account_currency"),
                )
                linked_id = str(linked.get("order_id"))

                def _link_exit_order(data: dict) -> dict:
                    for entry in data.get("positions", []):
                        if entry.get("position_id") == position_id:
                            ids = [
                                order_id
                                for order_id in (entry.get("exit_order_ids") or [])
                                if order_id != linked_id
                            ]
                            ids.append(linked_id)
                            entry["exit_order_ids"] = ids
                    return data

                state.positions_repo.update(_link_exit_order)
                affected_orders.append(linked_id)
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
