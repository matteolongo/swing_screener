"""Stop-suggestion concern."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

import pandas as pd

from swing_screener.errors import NotFoundError, ValidationError, ServiceError, UpstreamError
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.portfolio.state import (
    ManageConfig as ManageStateConfig,
    evaluate_positions,
)

from api.models.portfolio import PositionUpdate
from api.repositories.config_repo import ConfigRepository
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio._helpers import to_state_position
from api.utils.files import get_today_str

logger = logging.getLogger(__name__)


def _manage_cfg_from_repo(config_repo: ConfigRepository) -> ManageStateConfig:
    manage = config_repo.get().manage
    return ManageStateConfig(
        breakeven_at_R=manage.breakeven_at_r,
        trail_sma=manage.trail_sma,
        trail_after_R=manage.trail_after_r,
        sma_buffer_pct=manage.sma_buffer_pct,
        max_holding_days=manage.max_holding_days,
        time_stop_days=manage.time_stop_days,
        time_stop_min_r=manage.time_stop_min_r,
        exit_signal_days=getattr(manage, "exit_signal_days", 2),
    )


def _calc_start_date(entry_date: Optional[str], trail_sma: int) -> str:
    buffer_days = max(200, int(trail_sma * 3))
    try:
        entry_dt = pd.to_datetime(entry_date) if entry_date else pd.Timestamp.today()
    except (TypeError, ValueError):
        entry_dt = pd.Timestamp.today()
    today = pd.Timestamp.today()
    if entry_dt > today:
        entry_dt = today
    start_dt = entry_dt - pd.Timedelta(days=buffer_days)
    return start_dt.strftime("%Y-%m-%d")


class PositionStopAdvisor:
    """Stop-suggestion: compute, suggest, intraday preview."""

    def __init__(
        self,
        positions_repo: PositionsRepository,
        provider: Optional[MarketDataProvider] = None,
        config_repo: Optional[ConfigRepository] = None,
    ) -> None:
        self._positions_repo = positions_repo
        self._provider = provider or get_default_provider()
        self._config_repo = config_repo or ConfigRepository()

    def _resolve_manage_cfg(self, payload: Optional[dict] = None) -> ManageStateConfig:
        if payload is None:
            return _manage_cfg_from_repo(self._config_repo)
        return ManageStateConfig(
            breakeven_at_R=float(payload.get("breakeven_at_r", 1.0)),
            trail_sma=int(payload.get("trail_sma", 20)),
            trail_after_R=float(payload.get("trail_after_r", 2.0)),
            sma_buffer_pct=float(payload.get("sma_buffer_pct", 0.005)),
            max_holding_days=int(payload.get("max_holding_days", 20)),
            time_stop_days=int(payload.get("time_stop_days", 15)),
            time_stop_min_r=float(payload.get("time_stop_min_r", 0.5)),
            exit_signal_days=int(payload.get("exit_signal_days", 2)),
        )

    def _suggest_position_stop_from_dict(
        self,
        position: dict,
        manage_payload: Optional[dict] = None,
    ) -> PositionUpdate:
        if position.get("status") != "open":
            raise ValidationError("Stop suggestions require an open position")

        ticker = position.get("ticker")
        if not ticker:
            raise ValidationError("Position ticker is missing")

        manage_cfg = self._resolve_manage_cfg(manage_payload)
        start_date = _calc_start_date(position.get("entry_date"), manage_cfg.trail_sma)
        end_date = get_today_str()

        try:
            ohlcv = self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=end_date)
        except Exception as exc:
            raise UpstreamError(
                f"Failed to fetch market data for {ticker}: {exc}",
            ) from exc

        try:
            updates, _ = evaluate_positions(ohlcv, [to_state_position(position)], manage_cfg)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        except Exception as exc:
            raise ServiceError(
                f"Failed to compute stop suggestion: {exc}",
            ) from exc

        if not updates:
            raise ServiceError("No stop suggestion available")

        update = updates[0]
        return PositionUpdate(
            ticker=update.ticker,
            status=update.status,
            last=update.last,
            entry=update.entry,
            stop_old=update.stop_old,
            stop_suggested=update.stop_suggested,
            shares=update.shares,
            r_now=update.r_now,
            action=update.action,
            reason=update.reason,
            exhaustion_score=update.exhaustion_score,
            exhaustion_label=update.exhaustion_label,
        )

    def compute_position_stop_suggestion(
        self,
        position_payload: dict,
        manage_payload: Optional[dict] = None,
    ) -> PositionUpdate:
        return self._suggest_position_stop_from_dict(position_payload, manage_payload)

    def suggest_position_stop(self, position_id: str) -> PositionUpdate:
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise NotFoundError(f"Position not found: {position_id}")
        return self._suggest_position_stop_from_dict(position)

    def suggest_stop_intraday(
        self,
        position_id: str,
        price: Optional[float] = None,
    ) -> PositionUpdate:
        position = self._positions_repo.get_position(position_id)
        if position is None:
            raise NotFoundError(f"Position not found: {position_id}")
        if position.get("status") != "open":
            raise ValidationError("Position is not open")

        ticker = position.get("ticker")
        if not ticker:
            raise ValidationError("Position ticker is missing")

        manage_cfg = self._resolve_manage_cfg(None)
        start_date = _calc_start_date(position.get("entry_date"), manage_cfg.trail_sma)
        yesterday = (dt.date.today() - dt.timedelta(days=1)).isoformat()

        try:
            ohlcv = self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=yesterday)
        except Exception as exc:
            raise UpstreamError(
                f"Failed to fetch market data: {exc}",
            ) from exc

        if price is None:
            try:
                price = self._provider.fetch_latest_price(ticker)
            except Exception as exc:
                raise UpstreamError(
                    f"Failed to fetch live price for {ticker}: {exc}",
                ) from exc

        today_idx = pd.Timestamp(dt.date.today())
        for field in ["Open", "High", "Low", "Close", "Volume"]:
            col = (field, ticker)
            if col in ohlcv.columns:
                val = price if field != "Volume" else 0.0
                ohlcv.loc[today_idx, col] = val

        try:
            updates, _ = evaluate_positions(ohlcv, [to_state_position(position)], manage_cfg)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        except Exception as exc:
            raise ServiceError(
                f"Failed to compute stop preview: {exc}",
            ) from exc

        if not updates:
            raise ServiceError("No stop preview available")

        update = updates[0]
        return PositionUpdate(
            ticker=update.ticker,
            status=update.status,
            last=update.last,
            entry=update.entry,
            stop_old=update.stop_old,
            stop_suggested=update.stop_suggested,
            shares=update.shares,
            r_now=update.r_now,
            action=update.action,
            reason=update.reason,
            exhaustion_score=update.exhaustion_score,
            exhaustion_label=update.exhaustion_label,
        )
