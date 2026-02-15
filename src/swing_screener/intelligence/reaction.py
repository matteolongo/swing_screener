from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import pandas as pd

from swing_screener.intelligence.config import CatalystConfig
from swing_screener.intelligence.models import CatalystSignal, Event


@dataclass(frozen=True)
class ReactionMetrics:
    valid: bool
    event_bar: str | None
    event_return: float
    return_z: float
    atr: float
    atr_shock: float
    reasons: tuple[str, ...]


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _coerce_datetime(raw: Any) -> datetime | None:
    if isinstance(raw, datetime):
        return _to_utc_naive(raw)
    text = str(raw).strip()
    if not text:
        return None
    try:
        return _to_utc_naive(datetime.fromisoformat(text.replace("Z", "+00:00")))
    except ValueError:
        return None


def _extract_symbol_ohlcv(ohlcv: pd.DataFrame, symbol: str) -> pd.DataFrame:
    symbol = str(symbol).strip().upper()
    if ohlcv.empty:
        return pd.DataFrame()

    if isinstance(ohlcv.columns, pd.MultiIndex):
        fields = ("Open", "High", "Low", "Close")
        data: dict[str, pd.Series] = {}
        for field in fields:
            key = (field, symbol)
            if key in ohlcv.columns:
                data[field.lower()] = ohlcv[key]
        frame = pd.DataFrame(data, index=ohlcv.index)
    else:
        rename_map = {c: str(c).lower() for c in ohlcv.columns}
        frame = ohlcv.rename(columns=rename_map)
        frame = frame[[c for c in ("open", "high", "low", "close") if c in frame.columns]]

    if "close" not in frame.columns:
        return pd.DataFrame()

    index = pd.to_datetime(frame.index, errors="coerce")
    if getattr(index, "tz", None) is not None:
        index = index.tz_convert(UTC).tz_localize(None)
    frame.index = index
    frame = frame.dropna(subset=["close"]).sort_index()
    return frame


def _resolve_event_bar(index: pd.DatetimeIndex, event_dt: datetime) -> pd.Timestamp | None:
    if index.empty:
        return None
    anchor = pd.Timestamp(event_dt).normalize()
    pos = int(index.searchsorted(anchor))
    if pos >= len(index):
        return None
    return pd.Timestamp(index[pos])


def evaluate_event_reaction(
    *,
    ohlcv: pd.DataFrame,
    symbol: str,
    event_time: str | datetime,
    z_lookback: int = 20,
    atr_window: int = 14,
) -> ReactionMetrics:
    frame = _extract_symbol_ohlcv(ohlcv, symbol)
    if frame.empty:
        return ReactionMetrics(
            valid=False,
            event_bar=None,
            event_return=0.0,
            return_z=0.0,
            atr=0.0,
            atr_shock=0.0,
            reasons=("symbol_data_missing",),
        )

    event_dt = _coerce_datetime(event_time)
    if event_dt is None:
        return ReactionMetrics(
            valid=False,
            event_bar=None,
            event_return=0.0,
            return_z=0.0,
            atr=0.0,
            atr_shock=0.0,
            reasons=("invalid_event_time",),
        )

    event_bar = _resolve_event_bar(frame.index, event_dt)
    if event_bar is None:
        return ReactionMetrics(
            valid=False,
            event_bar=None,
            event_return=0.0,
            return_z=0.0,
            atr=0.0,
            atr_shock=0.0,
            reasons=("no_trading_bar_after_event",),
        )

    pos = int(frame.index.get_loc(event_bar))
    close = frame["close"].astype(float)
    high = frame["high"].astype(float) if "high" in frame.columns else close
    low = frame["low"].astype(float) if "low" in frame.columns else close

    returns = close.pct_change()
    event_return = float(returns.iloc[pos]) if pos > 0 and pd.notna(returns.iloc[pos]) else 0.0
    history = returns.iloc[max(0, pos - max(5, z_lookback)):pos].dropna()

    reasons: list[str] = []
    return_z = 0.0
    if len(history) >= 5:
        baseline_mean = float(history.mean())
        baseline_std = float(history.std(ddof=0))
        if baseline_std > 1e-12:
            return_z = (event_return - baseline_mean) / baseline_std
        else:
            reasons.append("low_volatility_baseline")
    else:
        reasons.append("insufficient_history")

    prev_close = close.shift(1)
    tr = pd.concat(
        [
            (high - low).abs(),
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    atr_series = tr.shift(1).rolling(window=max(2, atr_window), min_periods=max(3, atr_window // 2)).mean()
    atr = float(atr_series.iloc[pos]) if pd.notna(atr_series.iloc[pos]) else 0.0
    event_tr = float(tr.iloc[pos]) if pd.notna(tr.iloc[pos]) else 0.0
    atr_shock = (event_tr / atr) if atr > 1e-12 else 0.0
    if atr <= 1e-12:
        reasons.append("atr_unavailable")

    return ReactionMetrics(
        valid=True,
        event_bar=event_bar.isoformat(),
        event_return=float(event_return),
        return_z=float(return_z),
        atr=float(atr),
        atr_shock=float(atr_shock),
        reasons=tuple(reasons),
    )


def _recency_hours(event_time: str, asof_dt: datetime) -> float:
    event_dt = _coerce_datetime(event_time)
    if event_dt is None:
        return 0.0
    delta = _to_utc_naive(asof_dt) - event_dt
    return max(0.0, delta.total_seconds() / 3600.0)


def build_catalyst_signals(
    *,
    events: list[Event],
    ohlcv: pd.DataFrame,
    cfg: CatalystConfig,
    asof_dt: datetime | None = None,
) -> list[CatalystSignal]:
    now = _to_utc_naive(asof_dt or datetime.utcnow())
    signals: list[CatalystSignal] = []

    for event in events:
        metrics = evaluate_event_reaction(
            ohlcv=ohlcv,
            symbol=event.symbol,
            event_time=event.occurred_at,
            z_lookback=20,
            atr_window=14,
        )
        reasons = list(metrics.reasons)
        is_false = False
        if cfg.require_price_confirmation:
            if metrics.return_z < cfg.false_catalyst_return_z:
                is_false = True
                reasons.append("return_z_below_threshold")
            if metrics.atr_shock < cfg.min_price_reaction_atr:
                is_false = True
                reasons.append("atr_shock_below_threshold")
            if not metrics.valid:
                is_false = True
        signal = CatalystSignal(
            symbol=event.symbol,
            event_id=event.event_id,
            return_z=round(metrics.return_z, 6),
            atr_shock=round(metrics.atr_shock, 6),
            peer_confirmation_count=0,
            recency_hours=round(_recency_hours(event.occurred_at, now), 3),
            is_false_catalyst=is_false,
            reasons=reasons,
        )
        signals.append(signal)

    signals.sort(key=lambda s: (s.recency_hours, s.return_z), reverse=False)
    return signals

