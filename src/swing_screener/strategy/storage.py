from __future__ import annotations

from copy import deepcopy
import datetime as dt
from pathlib import Path
from typing import Any

from swing_screener.settings import (
    config_dir,
    get_settings_manager,
    strategies_yaml_path,
)
from swing_screener.settings.io import dump_yaml_file, load_yaml_file


DEFAULT_STRATEGY_ID = "default"
CONFIG_DIR = config_dir()
DATA_DIR = CONFIG_DIR
STRATEGIES_FILE = strategies_yaml_path()
ACTIVE_STRATEGY_FILE = STRATEGIES_FILE
_LEGACY_REMOVED_PLUGIN_KEY = "soc" "ial" "_overlay"


def _ensure_config_dir() -> None:
    STRATEGIES_FILE.parent.mkdir(parents=True, exist_ok=True)


def _read_yaml(path: Path) -> Any:
    return load_yaml_file(path)


def _write_yaml(path: Path, payload: Any) -> None:
    _ensure_config_dir()
    dump_yaml_file(path, payload)


def _default_market_intelligence_payload() -> dict:
    defaults = get_settings_manager().get_strategy_defaults_payload()
    market_intelligence = defaults.get("market_intelligence", {})
    return deepcopy(market_intelligence if isinstance(market_intelligence, dict) else {})


def _default_strategy_payload(now: dt.datetime | None = None) -> dict:
    defaults = get_settings_manager().get_strategy_defaults_payload()
    ts = (now or dt.datetime.now()).replace(microsecond=0).isoformat()
    payload = deepcopy(defaults)
    payload.setdefault("id", DEFAULT_STRATEGY_ID)
    payload.setdefault("name", "Default")
    payload.setdefault("description", "Default strategy seeded from YAML system settings.")
    payload.setdefault("module", "momentum")
    payload.setdefault("is_default", True)
    payload.setdefault("created_at", ts)
    payload.setdefault("updated_at", ts)
    return payload


def _sanitize_strategy_payload(strategy: dict) -> dict:
    payload = deepcopy(strategy)
    payload.pop(_LEGACY_REMOVED_PLUGIN_KEY, None)
    market_intelligence = payload.get("market_intelligence")
    if isinstance(market_intelligence, dict):
        llm = market_intelligence.get("llm")
        if isinstance(llm, dict):
            llm.pop("api_key", None)
    return payload


def _load_document() -> dict[str, Any]:
    _ensure_config_dir()
    if not STRATEGIES_FILE.exists():
        payload = {
            "active_strategy_id": DEFAULT_STRATEGY_ID,
            "strategies": [_default_strategy_payload()],
        }
        _write_yaml(STRATEGIES_FILE, payload)
        return payload

    data = _read_yaml(STRATEGIES_FILE)
    if not isinstance(data, dict):
        raise ValueError("strategies.yaml must contain a mapping")
    return data


def _save_document(payload: dict[str, Any]) -> None:
    _write_yaml(STRATEGIES_FILE, payload)


def _normalize_document(doc: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    raw_strategies = doc.get("strategies", [])
    strategies = raw_strategies if isinstance(raw_strategies, list) else []
    active_strategy_id = str(doc.get("active_strategy_id") or DEFAULT_STRATEGY_ID)
    dirty = raw_strategies is not strategies or str(doc.get("active_strategy_id") or "") != active_strategy_id

    defaults = _default_strategy_payload()
    market_intelligence_default = _default_market_intelligence_payload()
    normalized: list[dict[str, Any]] = []

    for raw_strategy in strategies:
        if not isinstance(raw_strategy, dict):
            dirty = True
            continue
        if _LEGACY_REMOVED_PLUGIN_KEY in raw_strategy:
            dirty = True
        strategy = _sanitize_strategy_payload(raw_strategy)

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
            risk["rr_target"] = float(legacy_take_profit) if legacy_take_profit is not None else 2.0
            dirty = True

        if risk.get("commission_pct") is None:
            risk["commission_pct"] = float(legacy_commission) if legacy_commission is not None else 0.0
            dirty = True

        if "backtest" in strategy:
            strategy.pop("backtest", None)
            dirty = True

        universe = strategy.get("universe")
        if isinstance(universe, dict):
            filt = universe.get("filt")
            if isinstance(filt, dict) and filt.get("currencies") is None:
                filt["currencies"] = ["USD", "EUR"]
                dirty = True

        market_intelligence = strategy.get("market_intelligence")
        if not isinstance(market_intelligence, dict):
            strategy["market_intelligence"] = deepcopy(market_intelligence_default)
            dirty = True
        else:
            if market_intelligence.get("providers") is None:
                market_intelligence["providers"] = deepcopy(market_intelligence_default.get("providers", ["yahoo_finance"]))
                dirty = True
            if market_intelligence.get("universe_scope") is None:
                market_intelligence["universe_scope"] = market_intelligence_default.get("universe_scope", "screener_universe")
                dirty = True
            if market_intelligence.get("market_context_symbols") is None:
                market_intelligence["market_context_symbols"] = deepcopy(
                    market_intelligence_default.get("market_context_symbols", ["SPY", "QQQ", "XLK", "SMH", "XBI"])
                )
                dirty = True
            for section in ("llm", "catalyst", "theme", "opportunity", "sources", "scoring_v2", "calendar"):
                current_section = market_intelligence.get(section)
                default_section = market_intelligence_default.get(section, {})
                if not isinstance(current_section, dict):
                    market_intelligence[section] = deepcopy(default_section)
                    dirty = True
                    continue
                if isinstance(default_section, dict):
                    for key, value in default_section.items():
                        current_value = current_section.get(key)
                        if current_value is None:
                            current_section[key] = deepcopy(value)
                            dirty = True
                            continue
                        if isinstance(value, dict) and isinstance(current_value, dict):
                            for nested_key, nested_value in value.items():
                                if current_value.get(nested_key) is None:
                                    current_value[nested_key] = deepcopy(nested_value)
                                    dirty = True

        for key, value in defaults.items():
            if strategy.get(key) is None:
                strategy[key] = deepcopy(value)
                dirty = True

        if strategy.get("id") == DEFAULT_STRATEGY_ID:
            strategy["is_default"] = True
        normalized.append(strategy)

    if not any(item.get("id") == DEFAULT_STRATEGY_ID for item in normalized):
        normalized.insert(0, _default_strategy_payload())
        dirty = True

    if active_strategy_id not in {str(item.get("id", "")) for item in normalized}:
        active_strategy_id = DEFAULT_STRATEGY_ID
        dirty = True

    return {
        "active_strategy_id": active_strategy_id,
        "strategies": normalized,
    }, dirty


def load_strategies() -> list[dict]:
    doc = _load_document()
    normalized_doc, dirty = _normalize_document(doc)
    if dirty:
        _save_document(normalized_doc)
    return deepcopy(normalized_doc["strategies"])


def save_strategies(strategies: list[dict]) -> None:
    doc = _load_document()
    payload = {
        "active_strategy_id": str(doc.get("active_strategy_id") or DEFAULT_STRATEGY_ID),
        "strategies": [_sanitize_strategy_payload(strategy) for strategy in strategies],
    }
    normalized_doc, _dirty = _normalize_document(payload)
    _save_document(normalized_doc)


def get_strategy_by_id(strategy_id: str) -> dict | None:
    strategy_id = str(strategy_id)
    strategies = load_strategies()
    for strategy in strategies:
        if strategy.get("id") == strategy_id:
            return strategy
    return None


def load_active_strategy_id() -> str:
    doc = _load_document()
    normalized_doc, dirty = _normalize_document(doc)
    if dirty:
        _save_document(normalized_doc)
    return str(normalized_doc.get("active_strategy_id") or DEFAULT_STRATEGY_ID)


def set_active_strategy_id(strategy_id: str) -> None:
    doc = _load_document()
    doc["active_strategy_id"] = str(strategy_id)
    normalized_doc, _dirty = _normalize_document(doc)
    _save_document(normalized_doc)


def get_active_strategy() -> dict:
    strategies = load_strategies()
    active_id = load_active_strategy_id()
    for strategy in strategies:
        if strategy.get("id") == active_id:
            return strategy
    for strategy in strategies:
        if strategy.get("id") == DEFAULT_STRATEGY_ID:
            set_active_strategy_id(DEFAULT_STRATEGY_ID)
            return strategy
    payload = _default_strategy_payload()
    save_strategies([payload])
    set_active_strategy_id(DEFAULT_STRATEGY_ID)
    return payload
