from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
from pathlib import Path
import json
import math
from dataclasses import replace

import pandas as pd

from swing_screener.db import Database, get_default_db, model_to_position


PositionStatus = Literal["open", "closed"]


@dataclass
class Position:
    ticker: str
    status: PositionStatus
    entry_date: str
    entry_price: float
    stop_price: float
    shares: int
    position_id: Optional[str] = None
    source_order_id: Optional[str] = None
    initial_risk: Optional[float] = None
    max_favorable_price: Optional[float] = None
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    notes: str = ""
    exit_order_ids: Optional[list[str]] = field(default=None)


@dataclass
class ManageConfig:
    # trailing rules (simple and safe)
    breakeven_at_R: float = 1.0  # when R >= 1, move stop to entry
    trail_sma: int = 20  # after R >= trail_after_R, trail under SMA
    trail_after_R: float = 2.0
    sma_buffer_pct: float = 0.005  # buffer under SMA (0.5%)
    max_holding_days: int = 20  # time exit
    benchmark: str = "SPY"


@dataclass
class PositionUpdate:
    ticker: str
    status: PositionStatus
    last: float
    entry: float
    stop_old: float
    stop_suggested: float
    shares: int
    r_now: float
    action: Literal["NO_ACTION", "MOVE_STOP_UP", "CLOSE_STOP_HIT", "CLOSE_TIME_EXIT"]
    reason: str


def load_positions(path: str | Path = None, db: Database = None) -> list[Position]:
    """Load positions from database.
    
    Args:
        path: Legacy parameter for backward compatibility (ignored if db provided)
        db: Database instance to use. If None, uses default database.
        
    Returns:
        List of Position objects
    """
    if db is None:
        db = get_default_db()
    
    session = db.get_session()
    try:
        from swing_screener.db import PositionModel
        models = session.query(PositionModel).all()
        return [model_to_position(m) for m in models]
    finally:
        session.close()


def save_positions(
    path: str | Path, positions: list[Position], asof: Optional[str] = None
) -> None:
    """[DEPRECATED] Save positions to database.
    
    This function is kept for backward compatibility but now uses the database.
    The file-based persistence is no longer used.
    
    Args:
        path: Ignored (kept for backward compatibility)
        positions: List of positions to save
        asof: Ignored (kept for backward compatibility)
    """
    import warnings
    warnings.warn(
        "save_positions is deprecated. Positions are now persisted via database transactions.",
        DeprecationWarning,
        stacklevel=2
    )
    # For now, do nothing as positions should be saved via transactions
    pass


def scale_in_position(
    position: Position,
    add_entry_price: float,
    add_shares: int,
    *,
    keep_stop: bool = True,
    new_stop: Optional[float] = None,
    recompute_initial_risk: bool = True,
) -> Position:
    """
    Blend an add-on entry into an existing open position.
    """
    if add_shares <= 0:
        raise ValueError("add_shares must be > 0")
    if add_entry_price <= 0:
        raise ValueError("add_entry_price must be > 0")
    if position.shares <= 0:
        raise ValueError("position.shares must be > 0")

    new_shares = int(position.shares + add_shares)
    total_cost = (position.entry_price * position.shares) + (add_entry_price * add_shares)
    new_entry = float(total_cost / new_shares)

    if keep_stop:
        stop = float(position.stop_price)
    else:
        stop_candidate = position.stop_price if new_stop is None else float(new_stop)
        stop = max(float(position.stop_price), float(stop_candidate))

    if new_entry <= stop:
        raise ValueError("Blended entry must be above stop price.")

    initial_risk = position.initial_risk
    if recompute_initial_risk:
        initial_risk = round(float(new_entry - stop), 4)

    mfp = position.max_favorable_price
    if mfp is None:
        mfp = position.entry_price
    mfp_new = max(float(mfp), float(add_entry_price))

    return replace(
        position,
        entry_price=new_entry,
        shares=new_shares,
        stop_price=stop,
        initial_risk=initial_risk,
        max_favorable_price=mfp_new,
    )


def _get_close_series(ohlcv: pd.DataFrame, ticker: str) -> pd.Series:
    close = ohlcv["Close"]
    if ticker not in close.columns:
        raise ValueError(f"Ticker '{ticker}' not present in OHLCV Close.")
    return close[ticker].dropna()


def _sma(s: pd.Series, window: int) -> float:
    if len(s) < window:
        return float("nan")
    return float(s.rolling(window).mean().iloc[-1])


def evaluate_positions(
    ohlcv: pd.DataFrame,
    positions: list[Position],
    cfg: ManageConfig = ManageConfig(),
) -> tuple[list[PositionUpdate], list[Position]]:
    """
    Returns:
      - updates: instructions for the user (Degiro actions)
      - new_positions: same positions, but with updated max_favorable_price and potentially updated stop_price if you choose to apply automatically
        (we do NOT auto-apply stop updates here; we only suggest them)
    """
    updates: list[PositionUpdate] = []
    new_positions: list[Position] = []

    for pos in positions:
        if pos.status != "open":
            new_positions.append(pos)
            continue

        s = _get_close_series(ohlcv, pos.ticker)
        last = float(s.iloc[-1])

        # update max favorable
        mfp = (
            pos.max_favorable_price
            if pos.max_favorable_price is not None
            else pos.entry_price
        )
        mfp_new = max(mfp, last)

        # compute 1R per-share (use initial_risk if available)
        if pos.initial_risk is not None:
            risk_per_share = float(pos.initial_risk)
        else:
            risk_per_share = pos.entry_price - pos.stop_price
        if risk_per_share <= 0:
            raise ValueError(
                f"{pos.ticker}: initial_risk must be > 0 (entry - initial stop)."
            )
        r_now = (last - pos.entry_price) / risk_per_share

        # stop hit?
        if last <= pos.stop_price:
            upd = PositionUpdate(
                ticker=pos.ticker,
                status=pos.status,
                last=last,
                entry=pos.entry_price,
                stop_old=pos.stop_price,
                stop_suggested=pos.stop_price,
                shares=pos.shares,
                r_now=r_now,
                action="CLOSE_STOP_HIT",
                reason="Price <= stop (stop hit)",
            )
            updates.append(upd)
            # keep as open in state (you decide after execution), but you can mark closed manually later
            new_positions.append(
                Position(**{**pos.__dict__, "max_favorable_price": mfp_new})
            )
            continue

        # time exit (approx days using bars; assumes daily data)
        # we don’t have entry index here reliably without storing it; so we approximate by calendar string not ideal.
        # Practical: treat max_holding_days as optional until you store entry_index or entry_date alignment.
        # We'll still provide a conservative check if enough data exists after entry_date.
        try:
            entry_dt = pd.to_datetime(pos.entry_date)
            bars_since = int((s.index >= entry_dt).sum())
        except (ValueError, TypeError) as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "Failed to calculate bars_since for %s (entry_date=%s): %s",
                pos.ticker,
                pos.entry_date,
                exc
            )
            bars_since = 0

        if cfg.max_holding_days and bars_since >= cfg.max_holding_days:
            upd = PositionUpdate(
                ticker=pos.ticker,
                status=pos.status,
                last=last,
                entry=pos.entry_price,
                stop_old=pos.stop_price,
                stop_suggested=pos.stop_price,
                shares=pos.shares,
                r_now=r_now,
                action="CLOSE_TIME_EXIT",
                reason=f"Time exit: {bars_since} bars since entry_date >= {cfg.max_holding_days}",
            )
            updates.append(upd)
            new_positions.append(
                Position(**{**pos.__dict__, "max_favorable_price": mfp_new})
            )
            continue

        # suggested stop rules (only ever move UP)
        stop_suggested = pos.stop_price
        reason = "No rule triggered"

        # Rule 1: breakeven at +1R
        if r_now >= cfg.breakeven_at_R:
            stop_suggested = max(stop_suggested, pos.entry_price)
            reason = f"Breakeven: R={r_now:.2f} >= {cfg.breakeven_at_R}"

        # Rule 2: trail under SMA20 after +2R
        if r_now >= cfg.trail_after_R:
            sma_val = _sma(s, cfg.trail_sma)
            if not math.isnan(sma_val):
                trail_stop = sma_val * (1.0 - cfg.sma_buffer_pct)
                stop_suggested = max(stop_suggested, trail_stop)
                reason = f"Trail: R={r_now:.2f} >= {cfg.trail_after_R} and SMA{cfg.trail_sma} trail"

        if stop_suggested > pos.stop_price + 1e-9:
            action = "MOVE_STOP_UP"
        else:
            action = "NO_ACTION"

        updates.append(
            PositionUpdate(
                ticker=pos.ticker,
                status=pos.status,
                last=last,
                entry=pos.entry_price,
                stop_old=pos.stop_price,
                stop_suggested=float(stop_suggested),
                shares=pos.shares,
                r_now=float(r_now),
                action=action,
                reason=reason,
            )
        )

        new_positions.append(
            Position(**{**pos.__dict__, "max_favorable_price": mfp_new})
        )

    return updates, new_positions


def updates_to_dataframe(updates: list[PositionUpdate]) -> pd.DataFrame:
    return (
        pd.DataFrame([u.__dict__ for u in updates])
        .set_index("ticker")
        .sort_values(["action", "r_now"], ascending=[True, False])
    )

def apply_stop_updates(
    positions: list[Position],
    updates: list[PositionUpdate],
    only_if: set[str] | None = None,
) -> list[Position]:
    """
    Applica gli stop suggeriti nel file di stato, SOLO per tickers che rispettano i criteri.

    - Per default applica solo action == MOVE_STOP_UP
    - Non abbassa mai lo stop (solo aumenta)
    """
    only_if = only_if or {"MOVE_STOP_UP"}

    upd_map = {u.ticker: u for u in updates}

    out: list[Position] = []
    for p in positions:
        if p.status != "open":
            out.append(p)
            continue

        u = upd_map.get(p.ticker)
        if u is None:
            out.append(p)
            continue

        if u.action in only_if:
            new_stop = max(p.stop_price, float(u.stop_suggested))
            out.append(replace(p, stop_price=new_stop))
        else:
            out.append(p)

    return out


def render_degiro_actions_md(updates: list[PositionUpdate]) -> str:
    """
    Generate a Degiro-friendly Markdown checklist.

    Groups by action:
      - MOVE_STOP_UP
      - CLOSE_STOP_HIT / CLOSE_TIME_EXIT
      - NO_ACTION

    This is intentionally simple: it tells you exactly what to do in Degiro.
    """
    if not updates:
        return "# Degiro Actions\n\nNo updates.\n"

    def fmt(x: float) -> str:
        return f"{x:.2f}"

    def fmt_r(r: float) -> str:
        return f"{r:.2f}R"

    move = [u for u in updates if u.action == "MOVE_STOP_UP"]
    close = [u for u in updates if u.action in ("CLOSE_STOP_HIT", "CLOSE_TIME_EXIT")]
    none = [u for u in updates if u.action == "NO_ACTION"]

    lines: list[str] = []
    lines.append("# Degiro Actions")
    lines.append("")
    lines.append(f"_Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}_")
    lines.append("")
    lines.append("## 1) MOVE STOP (update stop-loss orders)")
    if not move:
        lines.append("- None")
    else:
        for u in move:
            lines.append(
                f"- **{u.ticker}**: stop {fmt(u.stop_old)} → **{fmt(u.stop_suggested)}** "
                f"(last {fmt(u.last)}, R {fmt_r(u.r_now)})"
            )

    lines.append("")
    lines.append("## 2) CLOSE (exit / check filled stops)")
    if not close:
        lines.append("- None")
    else:
        for u in close:
            lines.append(
                f"- **{u.ticker}**: **{u.action}** (last {fmt(u.last)}, stop {fmt(u.stop_old)}, R {fmt_r(u.r_now)})"
            )

    lines.append("")
    lines.append("## 3) NO ACTION (leave orders as-is)")
    if not none:
        lines.append("- None")
    else:
        for u in none:
            lines.append(
                f"- **{u.ticker}**: keep stop {fmt(u.stop_old)} (last {fmt(u.last)}, R {fmt_r(u.r_now)})"
            )

    lines.append("")
    lines.append("---")
    lines.append("### Notes")
    lines.append("- Apply changes **after US close** (Barcelona: ~22:15–22:45).")
    lines.append("- Never move stops down. Only up.")
    lines.append(
        "- This checklist does NOT place orders automatically; you execute in Degiro."
    )

    return "\n".join(lines) + "\n"
