"""Shared pure helpers used by multiple portfolio collaborators."""
from __future__ import annotations

from swing_screener.portfolio.state import Position as StatePosition


def to_state_position(position: dict) -> StatePosition:
    return StatePosition(
        ticker=str(position.get("ticker", "")).upper(),
        status=position.get("status", "open"),
        entry_date=str(position.get("entry_date", "")),
        entry_price=float(position.get("entry_price", 0)),
        stop_price=float(position.get("stop_price", 0)),
        shares=int(position.get("shares", 0)),
        position_id=position.get("position_id"),
        source_order_id=position.get("source_order_id"),
        initial_risk=(
            float(position["initial_risk"])
            if position.get("initial_risk") is not None
            else None
        ),
        max_favorable_price=(
            float(position["max_favorable_price"])
            if position.get("max_favorable_price") is not None
            else None
        ),
        exit_date=position.get("exit_date"),
        exit_price=(
            float(position["exit_price"])
            if position.get("exit_price") is not None
            else None
        ),
        notes=str(position.get("notes", "")),
        exit_order_ids=position.get("exit_order_ids"),
        trail_method=str(position.get("trail_method") or "sma20"),
        trail_param=(
            float(position["trail_param"])
            if position.get("trail_param") is not None
            else None
        ),
    )
