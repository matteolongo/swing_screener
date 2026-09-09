"""In-memory repository adapters for one stateless trading-state command."""

from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from typing import Any

from api.models.portfolio import TradingStateCommandResponse, TradingStateSnapshot
from api.utils.files import get_today_str
from swing_screener.errors import ConflictError


class InMemoryStrategyRepository:
    """Expose the active strategy from a supplied state snapshot."""

    def __init__(self, state: InMemoryTradingState) -> None:
        self._state = state

    def get_active_strategy(self) -> dict[str, Any]:
        return deepcopy(self._state._strategy)

    def get_active_strategy_id(self) -> str:
        return str(self._state._strategy.get("id") or "")

    def get_strategy(self, strategy_id: str) -> dict[str, Any] | None:
        strategy = self.get_active_strategy()
        return strategy if strategy.get("id") == strategy_id else None

    def list_strategies(self) -> list[dict[str, Any]]:
        return [self.get_active_strategy()]


class InMemoryPositionsRepository:
    """Implement the position repository methods used by portfolio services."""

    def __init__(self, state: InMemoryTradingState) -> None:
        self._state = state

    def read(self) -> dict[str, Any]:
        return {"positions": deepcopy(self._state._positions), "asof": get_today_str()}

    def list_positions(
        self, status: str | None = None
    ) -> tuple[list[dict[str, Any]], str]:
        positions = deepcopy(self._state._positions)
        if status:
            positions = [
                position for position in positions if position.get("status") == status
            ]
        return positions, get_today_str()

    def get_position(self, position_id: str) -> dict[str, Any] | None:
        for position in self._state._positions:
            if position.get("position_id") == position_id:
                return deepcopy(position)
        return None

    def update(
        self, modify_fn: Callable[[dict[str, Any]], dict[str, Any]]
    ) -> dict[str, Any]:
        updated = modify_fn(self.read())
        self._state._positions = deepcopy(updated.get("positions", []))
        return self.read()


class InMemoryOrdersRepository:
    """Implement the order repository methods used by order services."""

    def __init__(self, state: InMemoryTradingState) -> None:
        self._state = state

    def read(self) -> dict[str, Any]:
        return {"orders": deepcopy(self._state._orders), "asof": get_today_str()}

    def list_orders(
        self, status: str | None = None
    ) -> tuple[list[dict[str, Any]], str]:
        orders = deepcopy(self._state._orders)
        if status:
            orders = [order for order in orders if order.get("status") == status]
        return orders, get_today_str()

    def get_order(
        self, order_id: str, *, for_update: bool = False
    ) -> dict[str, Any] | None:
        del for_update
        for order in self._state._orders:
            if order.get("order_id") == order_id:
                return deepcopy(order)
        return None

    def append_order(self, order: dict[str, Any]) -> None:
        self._state._orders.append(deepcopy(order))

    def update_order(
        self, order_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        for order in self._state._orders:
            if order.get("order_id") == order_id:
                order.update(deepcopy(updates))
                return deepcopy(order)
        return None

    def submit_order(self, order_id: str) -> dict[str, Any] | None:
        order = self.get_order(order_id)
        if order is None:
            return None
        if order.get("status") == "pending":
            order["status"] = "submitted"
            self.update_order(order_id, order)
        return self.get_order(order_id)

    def cancel_order(self, order_id: str) -> dict[str, Any] | None:
        order = self.get_order(order_id)
        if order is None:
            return None
        if order.get("status") in ("pending", "submitted"):
            order["status"] = "cancelled"
            self.update_order(order_id, order)
        return self.get_order(order_id)


class InMemoryTradingState:
    """Mutable command-local state with repository adapters and revision checks."""

    def __init__(self, snapshot: TradingStateSnapshot) -> None:
        self._revision = snapshot.revision
        self._strategy = snapshot.strategy.model_dump(mode="json")
        self._positions = [
            position.model_dump(mode="json") for position in snapshot.positions
        ]
        self._orders = [order.model_dump(mode="json") for order in snapshot.orders]
        self.strategy_repo = InMemoryStrategyRepository(self)
        self.positions_repo = InMemoryPositionsRepository(self)
        self.orders_repo = InMemoryOrdersRepository(self)

    @property
    def snapshot(self) -> TradingStateSnapshot:
        return TradingStateSnapshot(
            revision=self._revision,
            strategy=deepcopy(self._strategy),
            positions=deepcopy(self._positions),
            orders=deepcopy(self._orders),
        )

    def commit(
        self,
        *,
        expected_revision: int,
        affected_order_ids: list[str] | None = None,
        affected_position_ids: list[str] | None = None,
    ) -> TradingStateCommandResponse:
        if expected_revision != self._revision:
            raise ConflictError(
                f"expected revision {expected_revision}, current revision is {self._revision}"
            )
        self._revision += 1
        return TradingStateCommandResponse(
            **self.snapshot.model_dump(),
            affected_order_ids=affected_order_ids or [],
            affected_position_ids=affected_position_ids or [],
        )
