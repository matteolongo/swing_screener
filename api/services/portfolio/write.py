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
from api.repositories.config_repo import ConfigRepository
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
    ) -> None:
        self._positions_repo = positions_repo
        self._provider = provider or get_default_provider()
        self._config_repo = config_repo or ConfigRepository()
        self._begin_write = begin_write or (lambda: None)

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
            data["asof"] = get_today_str()
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
            end_date = get_today_str()
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

        result: dict[str, float] = {}

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
                    data["asof"] = get_today_str()
                    result["old_stop"] = locked_stop
                    return data
            raise NotFoundError(f"Position not found: {position_id}")

        self._begin_write()
        self._positions_repo.update(_modify)

        return {
            "status": "ok",
            "position_id": position_id,
            "new_stop": new_stop,
            "old_stop": result["old_stop"],
        }

    def update_position_stop(
        self, position_id: str, request: UpdateStopRequest
    ) -> dict:
        return self.apply_position_stop(self.prepare_position_stop(position_id, request))

    def close_position(self, position_id: str, request: ClosePositionRequest) -> dict:
        def _modify(data: dict) -> dict:
            for pos in data.get("positions", []):
                if pos.get("position_id") == position_id:
                    if pos.get("status") != "open":
                        raise ValidationError("Position already closed")

                    pos["status"] = "closed"
                    pos["exit_price"] = request.exit_price
                    pos["exit_date"] = get_today_str()
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
                    data["asof"] = get_today_str()
                    return data
            raise NotFoundError(f"Position not found: {position_id}")

        self._begin_write()
        self._positions_repo.update(_modify)

        return {
            "status": "ok",
            "position_id": position_id,
            "exit_price": request.exit_price,
            "fee_eur": request.fee_eur,
            "exit_fx_rate": request.exit_fx_rate,
        }

    def partial_close_position(
        self, position_id: str, request: PartialCloseRequest
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
                    "date": get_today_str(),
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
                data["asof"] = get_today_str()
                result["r_at_close"] = round(r_at_close, 4)
                result["shares_remaining"] = pos["shares"]
                return data

            raise NotFoundError(f"Position not found: {position_id}")

        self._begin_write()
        self._positions_repo.update(_modify)

        return {
            "status": "ok",
            "position_id": position_id,
            "shares_closed": request.shares_closed,
            "price": request.price,
            "r_at_close": result["r_at_close"],
            "shares_remaining": result["shares_remaining"],
            "fx_rate": request.fx_rate,
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
                    data["asof"] = get_today_str()
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
