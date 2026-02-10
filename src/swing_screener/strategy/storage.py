from __future__ import annotations

from pathlib import Path
import datetime as dt
import json
from typing import Any


DEFAULT_STRATEGY_ID = "default"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


DATA_DIR = _repo_root() / "data"
STRATEGIES_FILE = DATA_DIR / "strategies.json"
ACTIVE_STRATEGY_FILE = DATA_DIR / "active_strategy.json"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: Any) -> None:
    _ensure_data_dir()
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _default_strategy_payload(now: dt.datetime | None = None) -> dict:
    ts = (now or dt.datetime.now()).replace(microsecond=0).isoformat()
    return {
        "id": DEFAULT_STRATEGY_ID,
        "name": "Default",
        "description": "Default strategy seeded from current system settings.",
        "module": "momentum",
        "is_default": True,
        "created_at": ts,
        "updated_at": ts,
        "universe": {
            "trend": {"sma_fast": 20, "sma_mid": 50, "sma_long": 200},
            "vol": {"atr_window": 14},
            "mom": {"lookback_6m": 126, "lookback_12m": 252, "benchmark": "SPY"},
            "filt": {
                "min_price": 5.0,
                "max_price": 500.0,
                "max_atr_pct": 15.0,
                "require_trend_ok": True,
                "require_rs_positive": False,
            },
        },
        "ranking": {
            "w_mom_6m": 0.45,
            "w_mom_12m": 0.35,
            "w_rs_6m": 0.2,
            "top_n": 100,
        },
        "signals": {"breakout_lookback": 50, "pullback_ma": 20, "min_history": 260},
        "risk": {
            "account_size": 50000.0,
            "risk_pct": 0.01,
            "max_position_pct": 0.6,
            "min_shares": 1,
            "k_atr": 2.0,
            "min_rr": 2.0,
            "max_fee_risk_pct": 0.2,
            "regime_enabled": False,
            "regime_trend_sma": 200,
            "regime_trend_multiplier": 0.5,
            "regime_vol_atr_window": 14,
            "regime_vol_atr_pct_threshold": 6.0,
            "regime_vol_multiplier": 0.5,
        },
        "manage": {
            "breakeven_at_r": 1.0,
            "trail_after_r": 2.0,
            "trail_sma": 20,
            "sma_buffer_pct": 0.005,
            "max_holding_days": 20,
            "benchmark": "SPY",
        },
        "backtest": {
            "entry_type": "auto",
            "exit_mode": "trailing_stop",
            "take_profit_r": 2.0,
            "max_holding_days": 20,
            "breakeven_at_r": 1.0,
            "trail_after_r": 2.0,
            "trail_sma": 20,
            "sma_buffer_pct": 0.005,
            "commission_pct": 0.0,
            "min_history": 260,
        },
        "social_overlay": {
            "enabled": False,
            "lookback_hours": 24,
            "attention_z_threshold": 3.0,
            "min_sample_size": 20,
            "negative_sent_threshold": -0.4,
            "sentiment_conf_threshold": 0.7,
            "hype_percentile_threshold": 95.0,
        },
    }


def load_strategies() -> list[dict]:
    _ensure_data_dir()
    if not STRATEGIES_FILE.exists():
        payload = [_default_strategy_payload()]
        _write_json(STRATEGIES_FILE, payload)
        return payload

    data = _read_json(STRATEGIES_FILE)
    if not isinstance(data, list):
        raise ValueError("strategies.json must contain a list of strategies")

    if not any(s.get("id") == DEFAULT_STRATEGY_ID for s in data):
        data.append(_default_strategy_payload())
        _write_json(STRATEGIES_FILE, data)

    return data


def save_strategies(strategies: list[dict]) -> None:
    _write_json(STRATEGIES_FILE, strategies)


def get_strategy_by_id(strategy_id: str) -> dict | None:
    strategy_id = str(strategy_id)
    strategies = load_strategies()
    for strategy in strategies:
        if strategy.get("id") == strategy_id:
            return strategy
    return None


def load_active_strategy_id() -> str:
    _ensure_data_dir()
    if not ACTIVE_STRATEGY_FILE.exists():
        _write_json(ACTIVE_STRATEGY_FILE, {"id": DEFAULT_STRATEGY_ID})
        return DEFAULT_STRATEGY_ID

    payload = _read_json(ACTIVE_STRATEGY_FILE)
    if isinstance(payload, dict) and payload.get("id"):
        return str(payload["id"])

    _write_json(ACTIVE_STRATEGY_FILE, {"id": DEFAULT_STRATEGY_ID})
    return DEFAULT_STRATEGY_ID


def set_active_strategy_id(strategy_id: str) -> None:
    _write_json(ACTIVE_STRATEGY_FILE, {"id": strategy_id})


def get_active_strategy() -> dict:
    strategies = load_strategies()
    active_id = load_active_strategy_id()
    for s in strategies:
        if s.get("id") == active_id:
            return s
    # fallback to default
    for s in strategies:
        if s.get("id") == DEFAULT_STRATEGY_ID:
            set_active_strategy_id(DEFAULT_STRATEGY_ID)
            return s
    payload = _default_strategy_payload()
    save_strategies([payload])
    set_active_strategy_id(DEFAULT_STRATEGY_ID)
    return payload
