"""Write-model: create/close/update positions."""
from __future__ import annotations

import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import pandas as pd

from swing_screener.errors import NotFoundError, ValidationError
from swing_screener.data.providers import MarketDataProvider, get_default_provider

from api.models.portfolio import (
    ClosePositionRequest,
    CreatePositionRequest,
    PartialCloseRequest,
    Position,
    UpdateStopRequest,
    UpdateTrailMethodRequest,
)
from api.repositories.positions_repo import PositionsRepository
from api.utils.files import get_today_str

logger = logging.getLogger(__name__)


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class PortfolioWriteService:
    """Write-model: create, close, partial-close, stop-update, trail-update."""

    def __init__(
        self,
        positions_repo: PositionsRepository,
        provider: Optional[MarketDataProvider] = None,
    ) -> None:
        self._positions_repo = positions_repo
        self._provider = provider or get_default_provider()

    def create_position(self, request: CreatePositionRequest) -> Position:
        """Register a position directly (after manual fill at DeGiro)."""
        data = self._positions_repo.read()
        positions = data.get("positions", [])

        ticker = request.ticker.upper()
        position_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
        initial_risk = round(request.entry_price - request.stop_price, 4)
        isin = request.isin

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
        }

        positions.append(new_position)
        data["positions"] = positions
        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return Position(**new_position)

    def update_position_stop(self, position_id: str, request: UpdateStopRequest) -> dict:
        data = self._positions_repo.read()
        positions = data.get("positions", [])
        found = False
        old_stop = None
        new_stop = _round_price(request.new_stop)

        for pos in positions:
            if pos.get("position_id") == position_id:
                if pos.get("status") != "open":
                    raise ValidationError("Cannot update stop on closed position")

                old_stop = _round_price(float(pos.get("stop_price")))

                if new_stop <= old_stop:
                    raise ValidationError(
                        f"Cannot move stop down. Current: {old_stop}, Requested: {new_stop}",
                    )

                ticker = pos.get("ticker")
                current_price = None
                try:
                    end_date = get_today_str()
                    start_date = (pd.Timestamp(end_date) - pd.Timedelta(days=5)).strftime("%Y-%m-%d")
                    ohlcv = self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=end_date)
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

                pos["stop_price"] = new_stop
                if request.reason:
                    current_notes = pos.get("notes", "")
                    pos["notes"] = f"{current_notes}\nStop updated to {new_stop}: {request.reason}".strip()

                found = True
                break

        if not found:
            raise NotFoundError(f"Position not found: {position_id}")

        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return {
            "status": "ok",
            "position_id": position_id,
            "new_stop": new_stop,
            "old_stop": old_stop,
        }

    def close_position(self, position_id: str, request: ClosePositionRequest) -> dict:
        data = self._positions_repo.read()
        positions = data.get("positions", [])
        found = False

        for pos in positions:
            if pos.get("position_id") == position_id:
                if pos.get("status") != "open":
                    raise ValidationError("Position already closed")

                pos["status"] = "closed"
                pos["exit_price"] = request.exit_price
                pos["exit_date"] = get_today_str()
                pos["exit_fee_eur"] = request.fee_eur
                if request.reason:
                    current_notes = pos.get("notes", "")
                    pos["notes"] = f"{current_notes}\nClosed: {request.reason}".strip()
                if request.lesson is not None:
                    pos["lesson"] = request.lesson
                pos["tags"] = list(request.tags)

                found = True
                break

        if not found:
            raise NotFoundError(f"Position not found: {position_id}")

        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return {
            "status": "ok",
            "position_id": position_id,
            "exit_price": request.exit_price,
            "fee_eur": request.fee_eur,
        }

    def partial_close_position(self, position_id: str, request: PartialCloseRequest) -> dict:
        """Close a subset of shares on an open position, recording a partial-close event."""
        data = self._positions_repo.read()
        positions = data.get("positions", [])
        found = False
        r_at_close = 0.0

        for pos in positions:
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
            stop_price = float(pos.get("stop_price", 0.0))
            per_share_risk = entry_price - stop_price
            r_at_close = (request.price - entry_price) / per_share_risk if per_share_risk != 0 else 0.0

            event = {
                "date": get_today_str(),
                "shares_closed": request.shares_closed,
                "price": request.price,
                "r_at_close": round(r_at_close, 4),
                "fee_eur": request.fee_eur,
            }

            if "partial_closes" not in pos or pos["partial_closes"] is None:
                pos["partial_closes"] = []
            pos["partial_closes"].append(event)
            pos["shares"] = current_shares - request.shares_closed
            found = True
            break

        if not found:
            raise NotFoundError(f"Position not found: {position_id}")

        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return {
            "status": "ok",
            "position_id": position_id,
            "shares_closed": request.shares_closed,
            "price": request.price,
            "r_at_close": round(r_at_close, 4),
            "shares_remaining": pos["shares"],
        }

    def update_trail_method(self, position_id: str, request: UpdateTrailMethodRequest) -> dict:
        data = self._positions_repo.read()
        positions = data.get("positions", [])
        for pos in positions:
            if pos.get("position_id") == position_id:
                if pos.get("status") != "open":
                    raise ValidationError(
                        "Cannot update trail method on a closed position",
                    )
                pos["trail_method"] = request.trail_method
                pos["trail_param"] = request.trail_param
                data["asof"] = get_today_str()
                self._positions_repo.write(data)
                return {
                    "status": "ok",
                    "position_id": position_id,
                    "trail_method": request.trail_method,
                    "trail_param": request.trail_param,
                }
        raise NotFoundError(f"Position {position_id} not found")
