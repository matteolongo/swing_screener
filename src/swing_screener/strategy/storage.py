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


def _default_market_intelligence_payload() -> dict:
    return {
        "enabled": False,
        "providers": ["yahoo_finance"],
        "universe_scope": "screener_universe",
        "market_context_symbols": ["SPY", "QQQ", "XLK", "SMH", "XBI"],
        "llm": {
            "enabled": False,
            "provider": "ollama",
            "model": "mistral:7b-instruct",
            "base_url": "http://localhost:11434",
            "api_key": "",
            "enable_cache": True,
            "enable_audit": True,
            "cache_path": "data/intelligence/llm_cache.json",
            "audit_path": "data/intelligence/llm_audit",
            "max_concurrency": 4,
        },
        "catalyst": {
            "lookback_hours": 72,
            "recency_half_life_hours": 36,
            "false_catalyst_return_z": 1.5,
            "min_price_reaction_atr": 0.8,
            "require_price_confirmation": True,
        },
        "theme": {
            "enabled": True,
            "min_cluster_size": 3,
            "min_peer_confirmation": 2,
            "curated_peer_map_path": "data/intelligence/peer_map.yaml",
        },
        "opportunity": {
            "technical_weight": 0.55,
            "catalyst_weight": 0.45,
            "max_daily_opportunities": 8,
            "min_opportunity_score": 0.55,
        },
        "sources": {
            "enabled": [
                "yahoo_finance",
                "earnings_calendar",
                "sec_edgar",
                "company_ir_rss",
            ],
            "scraping_enabled": False,
            "allowed_domains": [],
            "rate_limits": {
                "requests_per_minute": 90,
                "max_concurrency": 4,
            },
            "timeouts": {
                "connect_seconds": 5.0,
                "read_seconds": 20.0,
            },
            "scrape_policy": {
                "require_robots_allow": True,
                "deny_if_robots_unreachable": True,
                "require_tos_allow_flag": True,
                "user_agent": "swing-screener-intelligence-bot/1.0",
                "max_robots_cache_hours": 24,
            },
        },
        "scoring_v2": {
            "enabled": True,
            "weights": {
                "reaction_z_component": 0.22,
                "atr_shock_component": 0.12,
                "recency_component": 0.14,
                "proximity_component": 0.14,
                "materiality_component": 0.14,
                "source_quality_component": 0.10,
                "confirmation_component": 0.08,
                "filing_impact_component": 0.06,
                "uncertainty_penalty_component": 0.10,
            },
            "low_evidence_confirmation_threshold": 0.25,
            "low_evidence_source_quality_threshold": 0.45,
            "stale_event_decay_hours": 120,
        },
        "calendar": {
            "binary_event_window_days": 3,
            "binary_event_min_materiality": 0.75,
            "binary_event_min_threshold_boost": 0.08,
            "low_evidence_min_threshold_boost": 0.06,
        },
    }


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
                "currencies": ["USD", "EUR"],
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
            "rr_target": 2.0,
            "commission_pct": 0.0,
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
        "social_overlay": {
            "enabled": False,
            "lookback_hours": 24,
            "attention_z_threshold": 3.0,
            "min_sample_size": 20,
            "negative_sent_threshold": -0.4,
            "sentiment_conf_threshold": 0.7,
            "hype_percentile_threshold": 95.0,
            "providers": ["reddit"],
            "sentiment_analyzer": "keyword",
        },
        "market_intelligence": _default_market_intelligence_payload(),
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

    dirty = False
    for strategy in data:
        if not isinstance(strategy, dict):
            continue

        # Migrate legacy backtest defaults into risk config and remove backtest block.
        risk = strategy.get("risk")
        if not isinstance(risk, dict):
            risk = {}
            strategy["risk"] = risk
            dirty = True

        legacy_backtest = strategy.get("backtest")
        legacy_take_profit = None
        legacy_commission = None
        if isinstance(legacy_backtest, dict):
            legacy_take_profit = legacy_backtest.get("take_profit_r")
            legacy_commission = legacy_backtest.get("commission_pct")

        if risk.get("rr_target") is None:
            risk["rr_target"] = (
                float(legacy_take_profit)
                if legacy_take_profit is not None
                else 2.0
            )
            dirty = True

        if risk.get("commission_pct") is None:
            risk["commission_pct"] = (
                float(legacy_commission)
                if legacy_commission is not None
                else 0.0
            )
            dirty = True

        if "backtest" in strategy:
            strategy.pop("backtest", None)
            dirty = True

        universe = strategy.get("universe")
        if isinstance(universe, dict):
            filt = universe.get("filt")
            if isinstance(filt, dict):
                currencies = filt.get("currencies")
                if currencies is None:
                    filt["currencies"] = ["USD", "EUR"]
                    dirty = True

        social_overlay = strategy.get("social_overlay")
        if isinstance(social_overlay, dict):
            if social_overlay.get("providers") is None:
                social_overlay["providers"] = ["reddit"]
                dirty = True
            if social_overlay.get("sentiment_analyzer") is None:
                social_overlay["sentiment_analyzer"] = "keyword"
                dirty = True

        market_intelligence_default = _default_market_intelligence_payload()
        market_intelligence = strategy.get("market_intelligence")
        if not isinstance(market_intelligence, dict):
            strategy["market_intelligence"] = market_intelligence_default
            dirty = True
        else:
            if market_intelligence.get("providers") is None:
                market_intelligence["providers"] = market_intelligence_default["providers"]
                dirty = True
            if market_intelligence.get("universe_scope") is None:
                market_intelligence["universe_scope"] = market_intelligence_default["universe_scope"]
                dirty = True
            if market_intelligence.get("market_context_symbols") is None:
                market_intelligence["market_context_symbols"] = market_intelligence_default["market_context_symbols"]
                dirty = True

            for section in ("llm", "catalyst", "theme", "opportunity", "sources", "scoring_v2", "calendar"):
                current_section = market_intelligence.get(section)
                default_section = market_intelligence_default[section]
                if not isinstance(current_section, dict):
                    market_intelligence[section] = default_section
                    dirty = True
                    continue
                for key, value in default_section.items():
                    current_value = current_section.get(key)
                    if current_value is None:
                        current_section[key] = value
                        dirty = True
                        continue
                    if isinstance(value, dict) and isinstance(current_value, dict):
                        for nested_key, nested_value in value.items():
                            if current_value.get(nested_key) is None:
                                current_value[nested_key] = nested_value
                                dirty = True

    if not any(s.get("id") == DEFAULT_STRATEGY_ID for s in data):
        data.append(_default_strategy_payload())
        dirty = True

    if dirty:
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
