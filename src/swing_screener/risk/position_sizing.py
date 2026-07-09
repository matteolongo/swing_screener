from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Optional, Dict, Any
import re

import math
import pandas as pd
from swing_screener.settings import get_settings_manager


def _risk_defaults() -> dict:
    return get_settings_manager().get_low_level_defaults_payload("risk")


@dataclass(frozen=True)
class RiskConfig:
    account_size: float = field(default_factory=lambda: float(_risk_defaults().get("account_size", 500.0)))
    account_currency: str = field(default_factory=lambda: str(_risk_defaults().get("account_currency", "EUR")).upper())
    risk_pct: float = field(default_factory=lambda: float(_risk_defaults().get("risk_pct", 0.01)))
    k_atr: float = field(default_factory=lambda: float(_risk_defaults().get("k_atr", 2.0)))
    max_position_pct: float = field(default_factory=lambda: float(_risk_defaults().get("max_position_pct", 0.60)))
    min_shares: int = field(default_factory=lambda: int(_risk_defaults().get("min_shares", 1)))
    min_rr: float = field(default_factory=lambda: float(_risk_defaults().get("min_rr", 2.0)))
    rr_target: float = field(default_factory=lambda: float(_risk_defaults().get("rr_target", 2.0)))
    commission_pct: float = field(default_factory=lambda: float(_risk_defaults().get("commission_pct", 0.0)))
    max_fee_risk_pct: float = field(default_factory=lambda: float(_risk_defaults().get("max_fee_risk_pct", 0.20)))
    # Regime-aware risk scaling (optional)
    regime_enabled: bool = field(default_factory=lambda: bool(_risk_defaults().get("regime_enabled", False)))
    regime_trend_sma: int = field(default_factory=lambda: int(_risk_defaults().get("regime_trend_sma", 200)))
    regime_trend_multiplier: float = field(default_factory=lambda: float(_risk_defaults().get("regime_trend_multiplier", 0.5)))
    regime_vol_atr_window: int = field(default_factory=lambda: int(_risk_defaults().get("regime_vol_atr_window", 14)))
    regime_vol_atr_pct_threshold: float = field(default_factory=lambda: float(_risk_defaults().get("regime_vol_atr_pct_threshold", 6.0)))
    regime_vol_multiplier: float = field(default_factory=lambda: float(_risk_defaults().get("regime_vol_multiplier", 0.5)))


def _normalize_currency(value: object, fallback: str = "EUR") -> str:
    normalized = str(value or fallback or "").strip().upper()
    return normalized or fallback.upper()


def _normalize_quote_currency(value: object, account_currency: str) -> Optional[str]:
    if value is None:
        return account_currency
    normalized = str(value).strip().upper()
    if normalized in {"", "UNKNOWN"}:
        return None
    return normalized


def _normalize_account_to_quote_rate(value: float) -> float:
    rate = float(value)
    if not math.isfinite(rate) or rate <= 0:
        raise ValueError("account_to_quote_rate must be a positive finite number")
    return rate


def _lookup_account_to_quote_rate(
    *,
    account_currency: str,
    quote_currency: str,
    account_to_quote_rates: Optional[Dict[str, float]],
) -> Optional[float]:
    if quote_currency == account_currency:
        return 1.0
    if not account_to_quote_rates:
        return None

    candidates = (
        quote_currency,
        f"{account_currency}{quote_currency}",
        f"{account_currency}/{quote_currency}",
        f"{account_currency}->{quote_currency}",
    )
    for key in candidates:
        if key in account_to_quote_rates:
            return _normalize_account_to_quote_rate(account_to_quote_rates[key])
    return None


def compute_stop(entry: float, atr14: float, k_atr: float) -> float:
    if entry <= 0:
        raise ValueError("entry must be > 0")
    if atr14 <= 0:
        raise ValueError("atr14 must be > 0")
    if k_atr <= 0:
        raise ValueError("k_atr must be > 0")
    return entry - (k_atr * atr14)


def position_plan(
    entry: float,
    atr14: float,
    cfg: RiskConfig = RiskConfig(),
    *,
    quote_currency: Optional[str] = None,
    account_to_quote_rate: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """
    Build a position plan constrained by:
      - risk budget (account_size * risk_pct)
      - max position value (account_size * max_position_pct)

    Returns dict with entry/stop/shares/etc or None if not tradable.
    """
    account_currency = _normalize_currency(cfg.account_currency)
    quote_currency = _normalize_quote_currency(quote_currency, account_currency)
    if quote_currency is None:
        return None
    if quote_currency == account_currency:
        account_to_quote_rate = (
            1.0
            if account_to_quote_rate is None
            else _normalize_account_to_quote_rate(account_to_quote_rate)
        )
    elif account_to_quote_rate is None:
        return None
    else:
        account_to_quote_rate = _normalize_account_to_quote_rate(account_to_quote_rate)

    risk_amount_account = cfg.account_size * cfg.risk_pct
    risk_amount = risk_amount_account * account_to_quote_rate
    stop = compute_stop(entry, atr14, cfg.k_atr)

    risk_per_share = entry - stop
    if risk_per_share <= 0:
        return None

    shares_by_risk = math.floor(risk_amount / risk_per_share)
    if shares_by_risk < cfg.min_shares:
        return None

    max_position_value_account = cfg.account_size * cfg.max_position_pct
    max_position_value = max_position_value_account * account_to_quote_rate
    shares_by_cap = math.floor(max_position_value / entry)

    shares = min(shares_by_risk, shares_by_cap)
    if shares < cfg.min_shares:
        return None

    position_value = shares * entry
    realized_risk = shares * risk_per_share
    position_value_account = position_value / account_to_quote_rate
    realized_risk_account = realized_risk / account_to_quote_rate

    return {
        "entry": round(entry, 2),
        "stop": round(stop, 2),
        "atr14": round(atr14, 4),
        "k_atr": cfg.k_atr,
        "shares": int(shares),
        "account_currency": account_currency,
        "quote_currency": quote_currency,
        "account_to_quote_rate": round(account_to_quote_rate, 8),
        "position_value": round(position_value, 2),
        "position_value_quote": round(position_value, 2),
        "position_value_account": round(position_value_account, 2),
        "risk_amount_target": round(risk_amount, 2),
        "risk_amount_target_quote": round(risk_amount, 2),
        "risk_amount_target_account": round(risk_amount_account, 2),
        "risk_per_share": round(risk_per_share, 4),
        "realized_risk": round(realized_risk, 2),
        "realized_risk_quote": round(realized_risk, 2),
        "realized_risk_account": round(realized_risk_account, 2),
        "max_position_value": round(max_position_value, 2),
        "max_position_value_quote": round(max_position_value, 2),
        "max_position_value_account": round(max_position_value_account, 2),
    }


def build_trade_plans(
    ranked_universe: pd.DataFrame,
    signal_board: pd.DataFrame,
    cfg: RiskConfig = RiskConfig(),
    atr_col: Optional[str] = None,
    risk_multipliers: Optional[Dict[str, float]] = None,
    max_position_multipliers: Optional[Dict[str, float]] = None,
    account_to_quote_rates: Optional[Dict[str, float]] = None,
    vetoes: Optional[set[str]] = None,
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
        if vetoes and t in vetoes:
            continue

        if t not in ranked_universe.index:
            continue

        entry = float(active.loc[t, "last"])
        atr14 = float(ranked_universe.loc[t, atr_col])
        account_currency = _normalize_currency(cfg.account_currency)
        quote_currency = _normalize_quote_currency(
            ranked_universe.loc[t, "currency"]
            if "currency" in ranked_universe.columns
            else None,
            account_currency,
        )
        if quote_currency is None:
            continue
        account_to_quote_rate = _lookup_account_to_quote_rate(
            account_currency=account_currency,
            quote_currency=quote_currency,
            account_to_quote_rates=account_to_quote_rates,
        )
        if account_to_quote_rate is None:
            continue

        risk_mult = risk_multipliers.get(t, 1.0) if risk_multipliers else 1.0
        max_mult = (
            max_position_multipliers.get(t, 1.0) if max_position_multipliers else 1.0
        )
        risk_mult = max(0.0, float(risk_mult))
        max_mult = max(0.0, float(max_mult))

        cfg_for_t = cfg
        if risk_mult != 1.0 or max_mult != 1.0:
            cfg_for_t = replace(
                cfg,
                risk_pct=cfg.risk_pct * risk_mult,
                max_position_pct=cfg.max_position_pct * max_mult,
            )

        plan = position_plan(
            entry,
            atr14,
            cfg_for_t,
            quote_currency=quote_currency,
            account_to_quote_rate=account_to_quote_rate,
        )
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
