from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict, Any
import re

import math
import pandas as pd


@dataclass(frozen=True)
class RiskConfig:
    account_size: float = 500.0
    risk_pct: float = 0.01  # 1% of account per trade
    k_atr: float = 2.0  # stop = entry - k*ATR
    max_position_pct: float = 0.60  # max capital allocated to a single position
    min_shares: int = 1


def compute_stop(entry: float, atr14: float, k_atr: float) -> float:
    if entry <= 0:
        raise ValueError("entry must be > 0")
    if atr14 <= 0:
        raise ValueError("atr14 must be > 0")
    if k_atr <= 0:
        raise ValueError("k_atr must be > 0")
    return entry - (k_atr * atr14)


def position_plan(
    entry: float, atr14: float, cfg: RiskConfig = RiskConfig()
) -> Optional[Dict[str, Any]]:
    """
    Build a position plan constrained by:
      - risk budget (account_size * risk_pct)
      - max position value (account_size * max_position_pct)

    Returns dict with entry/stop/shares/etc or None if not tradable.
    """
    risk_amount = cfg.account_size * cfg.risk_pct
    stop = compute_stop(entry, atr14, cfg.k_atr)

    risk_per_share = entry - stop
    if risk_per_share <= 0:
        return None

    shares_by_risk = math.floor(risk_amount / risk_per_share)
    if shares_by_risk < cfg.min_shares:
        return None

    max_position_value = cfg.account_size * cfg.max_position_pct
    shares_by_cap = math.floor(max_position_value / entry)

    shares = min(shares_by_risk, shares_by_cap)
    if shares < cfg.min_shares:
        return None

    position_value = shares * entry
    realized_risk = shares * risk_per_share

    return {
        "entry": round(entry, 2),
        "stop": round(stop, 2),
        "atr14": round(atr14, 4),
        "k_atr": cfg.k_atr,
        "shares": int(shares),
        "position_value": round(position_value, 2),
        "risk_amount_target": round(risk_amount, 2),
        "risk_per_share": round(risk_per_share, 4),
        "realized_risk": round(realized_risk, 2),
        "max_position_value": round(max_position_value, 2),
    }


def build_trade_plans(
    ranked_universe: pd.DataFrame,
    signal_board: pd.DataFrame,
    cfg: RiskConfig = RiskConfig(),
    atr_col: Optional[str] = None,
) -> pd.DataFrame:
    """
    ranked_universe: per-ticker features (must include atr14 and last)
    signal_board: per-ticker signals (must include signal and last)

    Returns per-ticker trade plan for tickers with signal != 'none' and tradable sizing.
    """
    if ranked_universe is None or ranked_universe.empty:
        return pd.DataFrame()

    if signal_board is None or signal_board.empty:
        return pd.DataFrame()

    if atr_col is None:
        atr_candidates = [
            c for c in ranked_universe.columns if re.match(r"^atr\d+$", str(c))
        ]
        if len(atr_candidates) == 1:
            atr_col = atr_candidates[0]
        elif "atr14" in ranked_universe.columns:
            atr_col = "atr14"
        else:
            raise ValueError(
                "ranked_universe must contain a single atr{window} column (e.g. 'atr14') or provide atr_col."
            )

    if atr_col not in ranked_universe.columns:
        raise ValueError(f"ranked_universe missing atr column: {atr_col}")

    active = signal_board[signal_board["signal"] != "none"].copy()
    if active.empty:
        return pd.DataFrame()

    out_rows = []
    for t in active.index:
        if t not in ranked_universe.index:
            continue

        entry = float(active.loc[t, "last"])
        atr14 = float(ranked_universe.loc[t, atr_col])

        plan = position_plan(entry, atr14, cfg)
        if plan is None:
            continue

        out_rows.append(
            {
                "ticker": t,
                "signal": active.loc[t, "signal"],
                **plan,
            }
        )

    if not out_rows:
        return pd.DataFrame()

    df = pd.DataFrame(out_rows).set_index("ticker")

    sig_order = {"both": 0, "breakout": 1, "pullback": 2}
    df["signal_order"] = df["signal"].map(sig_order).fillna(99).astype(int)
    df = df.sort_values(
        ["signal_order", "realized_risk"], ascending=[True, False]
    ).drop(columns=["signal_order"])

    return df
