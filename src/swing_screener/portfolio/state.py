from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
from pathlib import Path
import json
import math
from dataclasses import replace

import pandas as pd


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


def load_positions(path: str | Path) -> list[Position]:
    p = Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    out: list[Position] = []
    for item in data.get("positions", []):
        out.append(
            Position(
                ticker=str(item["ticker"]).upper(),
                status=item.get("status", "open"),
                position_id=item.get("position_id", None),
                source_order_id=item.get("source_order_id", None),
                entry_date=item["entry_date"],
                entry_price=float(item["entry_price"]),
                stop_price=float(item["stop_price"]),
                shares=int(item["shares"]),
                initial_risk=(
                    float(item["initial_risk"])
                    if item.get("initial_risk") is not None
                    else None
                ),
                max_favorable_price=(
                    float(item["max_favorable_price"])
                    if item.get("max_favorable_price") is not None
                    else None
                ),
                notes=str(item.get("notes", "")),
                exit_order_ids=(
                    [str(x) for x in item.get("exit_order_ids", [])]
                    if isinstance(item.get("exit_order_ids", None), list)
                    else None
                ),
            )
        )
    return out


def save_positions(
    path: str | Path, positions: list[Position], asof: Optional[str] = None
) -> None:
    p = Path(path)
    payload = {
        "asof": asof,
        "positions": [
            {
                "ticker": pos.ticker,
                "status": pos.status,
                "position_id": pos.position_id,
                "source_order_id": pos.source_order_id,
                "entry_date": pos.entry_date,
                "entry_price": pos.entry_price,
                "stop_price": pos.stop_price,
                "shares": pos.shares,
                "initial_risk": pos.initial_risk,
                "max_favorable_price": pos.max_favorable_price,
                "notes": pos.notes,
                "exit_order_ids": pos.exit_order_ids,
            }
            for pos in positions
        ],
    }
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")


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

        # compute 1R per-share
        risk_per_share = pos.entry_price - pos.stop_price
        if risk_per_share <= 0:
            raise ValueError(f"{pos.ticker}: entry_price must be > stop_price.")
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
        except Exception:
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
