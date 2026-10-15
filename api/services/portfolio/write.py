"""Write-model: create/close/update positions."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Callable, Optional

import pandas as pd

from swing_screener.errors import ConflictError, NotFoundError, ValidationError
from swing_screener.data.currency import detect_currency
from swing_screener.data.providers import MarketDataProvider, get_market_data_provider

from api.models.portfolio import (
    ClosePositionRequest,
    CreatePositionRequest,
    PartialCloseRequest,
    Position,
    UpdateStopRequest,
    UpdateTrailMethodRequest,
)
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.repositories.config_repo import ConfigRepository
from api.services.portfolio.linked_exits import (
    linked_stop_order_id,
    reconcile_linked_exit_records,
)
from api.utils.files import get_today_str

logger = logging.getLogger(__name__)


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@dataclass(frozen=True)
class PreparedStopUpdate:
    position_id: str
    request: UpdateStopRequest
    old_stop: float
    new_stop: float


class PortfolioWriteService:
    """Write-model: create, close, partial-close, stop-update, trail-update."""

    def __init__(
        self,
        positions_repo: PositionsRepository,
        provider: Optional[MarketDataProvider] = None,
        config_repo: Optional[ConfigRepository] = None,
        begin_write: Callable[[], None] | None = None,
        business_date: Callable[[], str] | None = None,
        orders_repo: OrdersRepository | None = None,
    ) -> None:
        self._positions_repo = positions_repo
        self._orders_repo = orders_repo
        self._provider = provider or get_market_data_provider()
        self._config_repo = config_repo or ConfigRepository()
        self._begin_write = begin_write or (lambda: None)
        self._business_date = business_date or get_today_str

    def _reconcile_linked_exits(
        self,
        position: dict,
        *,
        filled_exit_order_id: str | None = None,
    ) -> list[str]:
        if self._orders_repo is None:
            return []

        orders, _ = self._orders_repo.list_orders()
        reconciled = reconcile_linked_exit_records(
            position,
            orders,
            filled_exit_order_id=filled_exit_order_id,
        )
        original_by_id = {str(order.get("order_id")): order for order in orders}
        changed_order_ids: list[str] = []
        for order in reconciled:
            order_id = str(order.get("order_id") or "")
            original = original_by_id.get(order_id)
            if original is None:
                continue
            updates = {
                key: value
                for key, value in order.items()
                if key not in {"order_id", "version"} and original.get(key) != value
            }
            if not updates:
                continue
            if self._orders_repo.update_order(order_id, updates) is None:
                raise ConflictError(f"Linked order not found: {order_id}")
            changed_order_ids.append(order_id)
        return changed_order_ids

    def _sync_linked_stop_order(
        self,
        position: dict,
        *,
        old_stop: float,
        order_id: str,
    ) -> str | None:
        if self._orders_repo is None:
            return None

        position_id = str(position["position_id"])
        orders, _ = self._orders_repo.list_orders()
        existing = next(
            (order for order in orders if order.get("order_id") == order_id), None
        )
        if existing is not None:
            if existing.get("status") not in {"pending", "submitted"}:
                raise ConflictError(
                    "A historical linked stop exists and requires manual reconciliation."
                )
            updated = self._orders_repo.update_order(
                order_id,
                {
                    "stop_price": position["stop_price"],
                    "quantity": position["shares"],
                    "notes": (
                        "Auto-created from position stop update " f"(was {old_stop})"
                    ),
                },
            )
            if updated is None:
                raise ConflictError(f"Linked order not found: {order_id}")
            return order_id

        order = {
            "order_id": order_id,
            "ticker": str(position["ticker"]).upper(),
            "status": "pending",
            "order_type": "SELL_STOP",
            "quantity": position["shares"],
            "limit_price": None,
            "stop_price": position["stop_price"],
            "target_price": None,
            "order_date": self._business_date(),
            "filled_date": None,
            "entry_price": None,
            "notes": f"Auto-created from position stop update (was {old_stop})",
            "order_kind": "stop",
            "parent_order_id": position.get("source_order_id"),
            "position_id": position_id,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": None,
            "thesis": None,
            "quote_currency": position.get("quote_currency"),
            "account_currency": position.get("account_currency"),
            "approval_fx_rate": None,
            "decision_context": None,
            "portfolio_approval": None,
        }
        self._orders_repo.append_order(order)
        return order_id

    def create_position(self, request: CreatePositionRequest) -> Position:
        """Register a position directly (after manual fill at DeGiro)."""
        ticker = request.ticker.upper()
        position_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
        initial_risk = round(request.entry_price - request.stop_price, 4)
        isin = request.isin
        quote_currency = str(
            request.quote_currency or detect_currency(ticker) or "UNKNOWN"
        ).upper()
        account_currency = str(
            request.account_currency or self._config_repo.get().risk.account_currency
        ).upper()
        entry_fx_rate = request.entry_fx_rate
        if quote_currency == account_currency:
            entry_fx_rate = 1.0
        elif entry_fx_rate is None:
            raise ValidationError(
                f"FX rate is required for {quote_currency}/{account_currency} positions"
            )

        new_position: dict = {
            "position_id": position_id,
            "ticker": ticker,
            "status": "open",
            "entry_date": request.entry_date,
            "entry_price": request.entry_price,
            "stop_price": request.stop_price,
            "target_price": request.target_price,
            "shares": request.shares,
            "initial_risk": initial_risk,
            "thesis": request.thesis,
            "isin": isin,
            "notes": request.notes,
            "broker": "manual",
            "entry_fee_eur": request.fee_eur,
            "quote_currency": quote_currency,
            "account_currency": account_currency,
            "entry_fx_rate": entry_fx_rate,
        }

        def _modify(data: dict) -> dict:
            positions = data.get("positions", [])
            positions.append(new_position)
            data["positions"] = positions
            data["asof"] = self._business_date()
            return data

        self._begin_write()
        self._positions_repo.update(_modify)

        return Position(**new_position)

    def prepare_position_stop(
        self, position_id: str, request: UpdateStopRequest
    ) -> PreparedStopUpdate:
        """Validate a stop update before acquiring the portfolio write lock."""
        new_stop = _round_price(request.new_stop)

        # Validate against a snapshot first (the price fetch is network I/O and must
        # not run while holding the write lock), then apply atomically below.
        pos0 = self._positions_repo.get_position(position_id)
        if pos0 is None:
            raise NotFoundError(f"Position not found: {position_id}")
        if pos0.get("status") != "open":
            raise ValidationError("Cannot update stop on closed position")

        old_stop = _round_price(float(pos0.get("stop_price")))
        if new_stop <= old_stop:
            raise ValidationError(
                f"Cannot move stop down. Current: {old_stop}, Requested: {new_stop}",
            )

        ticker = pos0.get("ticker")
        current_price = None
        try:
            end_date = self._business_date()
            start_date = (pd.Timestamp(end_date) - pd.Timedelta(days=5)).strftime(
                "%Y-%m-%d"
            )
            ohlcv = self._provider.fetch_ohlcv(
                [ticker], start_date=start_date, end_date=end_date
            )
            if not ohlcv.empty and ticker in ohlcv.columns.get_level_values(1):
                latest_close = ohlcv[("Close", ticker)].iloc[-1]
                if not pd.isna(latest_close):
                    current_price = float(latest_close)
        except Exception as exc:
            logger.warning("Could not fetch current price for validation: %s", exc)

        if current_price is not None and new_stop > current_price:
            raise ValidationError(
                f"Stop price ({new_stop}) must be at or below current price "
                f"({current_price}) for long positions",
            )

        return PreparedStopUpdate(
            position_id=position_id,
            request=request,
            old_stop=old_stop,
            new_stop=new_stop,
        )

    def apply_position_stop(self, prepared: PreparedStopUpdate) -> dict:
        """Persist a previously validated stop update under the write lock."""
        position_id = prepared.position_id
        request = prepared.request
        old_stop = prepared.old_stop
        new_stop = prepared.new_stop

        stop_order_id = linked_stop_order_id(position_id)
        if self._orders_repo is not None:
            orders, _ = self._orders_repo.list_orders()
            active_stops = [
                order
                for order in orders
                if order.get("position_id") == position_id
                and order.get("order_kind") == "stop"
                and order.get("status") in {"pending", "submitted"}
            ]
            if len(active_stops) > 1:
                raise ConflictError(
                    "Multiple active linked protective orders require manual reconciliation: stop"
                )
            if active_stops:
                stop_order_id = str(active_stops[0]["order_id"])

        result: dict[str, object] = {}

        def _modify(data: dict) -> dict:
            for pos in data.get("positions", []):
                if pos.get("position_id") == position_id:
                    if pos.get("status") != "open":
                        raise ValidationError("Cannot update stop on closed position")
                    locked_stop = _round_price(float(pos.get("stop_price")))
                    if locked_stop != old_stop:
                        raise ConflictError(
                            "Position changed while the stop update was being validated."
                        )
                    if new_stop <= locked_stop:
                        raise ValidationError(
                            f"Cannot move stop down. Current: {locked_stop}, Requested: {new_stop}"
                        )
                    pos["stop_price"] = new_stop
                    if request.reason:
                        current_notes = pos.get("notes", "")
                        pos["notes"] = (
                            f"{current_notes}\nStop updated to {new_stop}: {request.reason}".strip()
                        )
                    if self._orders_repo is not None:
                        pos["exit_order_ids"] = [
                            order_id
                            for order_id in (pos.get("exit_order_ids") or [])
                            if order_id != stop_order_id
                        ] + [stop_order_id]
                    data["asof"] = self._business_date()
                    result["old_stop"] = locked_stop
                    return data
            raise NotFoundError(f"Position not found: {position_id}")

        self._begin_write()
        updated_positions = self._positions_repo.update(_modify)
        updated_position = next(
            position
            for position in updated_positions["positions"]
            if position.get("position_id") == position_id
        )
        reconciled_order_ids = self._reconcile_linked_exits(updated_position)
        linked_order_id = self._sync_linked_stop_order(
            updated_position,
            old_stop=float(result["old_stop"]),
            order_id=stop_order_id,
        )
        linked_order_ids = [
            *reconciled_order_ids,
            *([linked_order_id] if linked_order_id else []),
        ]

        return {
            "status": "ok",
            "position_id": position_id,
            "new_stop": new_stop,
            "old_stop": result["old_stop"],
            "linked_order_ids": list(dict.fromkeys(linked_order_ids)),
        }

    def update_position_stop(
        self, position_id: str, request: UpdateStopRequest
    ) -> dict:
        return self.apply_position_stop(
            self.prepare_position_stop(position_id, request)
        )

    def close_position(
        self,
        position_id: str,
        request: ClosePositionRequest,
        *,
        filled_exit_order_id: str | None = None,
    ) -> dict:
        def _modify(data: dict) -> dict:
            for pos in data.get("positions", []):
                if pos.get("position_id") == position_id:
                    if pos.get("status") != "open":
                        raise ValidationError("Position already closed")

                    pos["status"] = "closed"
                    pos["exit_price"] = request.exit_price
                    pos["exit_date"] = self._business_date()
                    pos["exit_fee_eur"] = request.fee_eur
                    pos["exit_fx_rate"] = request.exit_fx_rate
                    if request.reason:
                        current_notes = pos.get("notes", "")
                        pos["notes"] = (
                            f"{current_notes}\nClosed: {request.reason}".strip()
                        )
                    if request.lesson is not None:
                        pos["lesson"] = request.lesson
                    pos["tags"] = list(request.tags)
                    data["asof"] = self._business_date()
                    return data
            raise NotFoundError(f"Position not found: {position_id}")

        self._begin_write()
        updated_positions = self._positions_repo.update(_modify)
        position = next(
            item
            for item in updated_positions["positions"]
            if item.get("position_id") == position_id
        )
        linked_order_ids = self._reconcile_linked_exits(
            position, filled_exit_order_id=filled_exit_order_id
        )

        return {
            "status": "ok",
            "position_id": position_id,
            "exit_price": request.exit_price,
            "fee_eur": request.fee_eur,
            "exit_fx_rate": request.exit_fx_rate,
            "linked_order_ids": linked_order_ids,
        }

    def partial_close_position(
        self,
        position_id: str,
        request: PartialCloseRequest,
        *,
        filled_exit_order_id: str | None = None,
    ) -> dict:
        """Close a subset of shares on an open position, recording a partial-close event."""
        result: dict = {}

        def _modify(data: dict) -> dict:
            for pos in data.get("positions", []):
                if pos.get("position_id") != position_id:
                    continue

                if pos.get("status") != "open":
                    raise ValidationError("Position is not open")

                current_shares = int(pos.get("shares", 0))
                if request.shares_closed >= current_shares:
                    raise ValidationError(
                        f"shares_closed ({request.shares_closed}) must be less than current shares ({current_shares}); use close_position to fully close",
                    )

                entry_price = float(pos.get("entry_price", 0.0))
                initial_risk = pos.get("initial_risk")
                if initial_risk is not None and float(initial_risk) > 0:
                    per_share_risk = float(initial_risk)
                else:
                    per_share_risk = entry_price - float(pos.get("stop_price", 0.0))
                r_at_close = (
                    (request.price - entry_price) / per_share_risk
                    if per_share_risk != 0
                    else 0.0
                )

                event = {
                    "date": self._business_date(),
                    "shares_closed": request.shares_closed,
                    "price": request.price,
                    "r_at_close": round(r_at_close, 4),
                    "fee_eur": request.fee_eur,
                    "fx_rate": request.fx_rate,
                }

                if "partial_closes" not in pos or pos["partial_closes"] is None:
                    pos["partial_closes"] = []
                pos["partial_closes"].append(event)
                pos["shares"] = current_shares - request.shares_closed
                data["asof"] = self._business_date()
                result["r_at_close"] = round(r_at_close, 4)
                result["shares_remaining"] = pos["shares"]
                return data

            raise NotFoundError(f"Position not found: {position_id}")

        self._begin_write()
        updated_positions = self._positions_repo.update(_modify)
        position = next(
            item
            for item in updated_positions["positions"]
            if item.get("position_id") == position_id
        )
        linked_order_ids = self._reconcile_linked_exits(
            position, filled_exit_order_id=filled_exit_order_id
        )

        return {
            "status": "ok",
            "position_id": position_id,
            "shares_closed": request.shares_closed,
            "price": request.price,
            "r_at_close": result["r_at_close"],
            "shares_remaining": result["shares_remaining"],
            "fx_rate": request.fx_rate,
            "linked_order_ids": linked_order_ids,
        }

    def update_trail_method(
        self, position_id: str, request: UpdateTrailMethodRequest
    ) -> dict:
        def _modify(data: dict) -> dict:
            for pos in data.get("positions", []):
                if pos.get("position_id") == position_id:
                    if pos.get("status") != "open":
                        raise ValidationError(
                            "Cannot update trail method on a closed position",
                        )
                    pos["trail_method"] = request.trail_method
                    pos["trail_param"] = request.trail_param
                    data["asof"] = self._business_date()
                    return data
            raise NotFoundError(f"Position {position_id} not found")

        self._begin_write()
        self._positions_repo.update(_modify)
        return {
            "status": "ok",
            "position_id": position_id,
            "trail_method": request.trail_method,
            "trail_param": request.trail_param,
        }
