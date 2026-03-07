from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


ROOT_DIR = Path(__file__).resolve().parents[3]
DEFAULT_STRATEGY_CONFIG = ROOT_DIR / "config" / "strategy.yaml"
PLUGINS_DIR = Path(__file__).resolve().parent / "plugins"
PHASE_ORDER = {
    "universe": 10,
    "ranking": 20,
    "signals": 30,
    "qualification": 40,
    "risk": 50,
    "management": 60,
    "intelligence": 70,
    "education": 80,
    "recommendation": 90,
}
KNOWN_INTERNAL_CAPABILITIES = {
    "candidate_eligibility",
    "signal_validation",
    "candidate_score",
    "risk_multiplier",
    "risk_budget",
    "recommendation_payload",
}


@dataclass(frozen=True)
class StrategyValidationIssue:
    plugin_id: str
    field: str | None
    level: str
    message: str
    source: str


def _read_yaml(path: Path) -> dict[str, Any]:
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, dict) else {}


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in override.items():
        current = out.get(key)
        if isinstance(current, dict) and isinstance(value, dict):
            out[key] = _deep_merge(current, value)
        else:
            out[key] = value
    return out


def _iter_plugin_dirs(base_dir: Path | None = None) -> list[Path]:
    plugins_dir = base_dir or PLUGINS_DIR
    if not plugins_dir.exists():
        return []
    return sorted(
        [path for path in plugins_dir.iterdir() if path.is_dir() and (path / "plugin.yaml").exists()],
        key=lambda path: path.name,
    )


def load_plugin_definitions(base_dir: Path | None = None) -> list[dict[str, Any]]:
    definitions: list[dict[str, Any]] = []
    for plugin_dir in _iter_plugin_dirs(base_dir):
        plugin = _read_yaml(plugin_dir / "plugin.yaml")
        plugin.setdefault("id", plugin_dir.name)
        plugin["path"] = str(plugin_dir)
        defaults_file = plugin_dir / plugin.get("defaults_file", "defaults.yaml")
        plugin["defaults"] = _read_yaml(defaults_file) if defaults_file.exists() else {}
        plugin.setdefault("config_schema", {})
        plugin.setdefault("read_only_sections", ["Configuration"])
        plugin.setdefault("dependencies", [])
        plugin.setdefault("runtime_hooks", [])
        plugin.setdefault("provides", [])
        plugin.setdefault("requires", [])
        plugin.setdefault("modifies", [])
        plugin.setdefault("conflicts", [])
        plugin.setdefault("phase", "qualification")
        definitions.append(plugin)
    return definitions


def load_plugin_definition_map(base_dir: Path | None = None) -> dict[str, dict[str, Any]]:
    return {plugin["id"]: plugin for plugin in load_plugin_definitions(base_dir)}


def load_strategy_yaml(config_path: Path | None = None) -> dict[str, Any]:
    path = config_path or DEFAULT_STRATEGY_CONFIG
    payload = _read_yaml(path)
    strategy = payload.get("strategy")
    return strategy if isinstance(strategy, dict) else {}


def resolve_strategy_config(
    *,
    config_path: Path | None = None,
    plugins_dir: Path | None = None,
) -> dict[str, Any]:
    plugin_map = load_plugin_definition_map(plugins_dir)
    strategy = load_strategy_yaml(config_path)

    metadata = {
      "id": str(strategy.get("id", "default")),
      "name": str(strategy.get("name", "Default")),
      "description": str(strategy.get("description", "Plugin-based strategy")),
      "module": str(strategy.get("module", "momentum")),
    }

    plugin_overrides = strategy.get("plugins", {}) if isinstance(strategy.get("plugins"), dict) else {}
    resolved_plugins: list[dict[str, Any]] = []
    for plugin_id, plugin in plugin_map.items():
        raw_override = plugin_overrides.get(plugin_id, {})
        if not isinstance(raw_override, dict):
            raw_override = {}
        enabled_override = raw_override.get("enabled")
        base_defaults = plugin.get("defaults", {})
        base_enabled = bool(base_defaults.get("enabled", plugin.get("enabled_by_default", False)))
        base_config = base_defaults.get("config", {}) if isinstance(base_defaults.get("config"), dict) else {}
        override_config = raw_override.get("config", {}) if isinstance(raw_override.get("config"), dict) else {}
        effective_config = _deep_merge(base_config, override_config)
        enabled = bool(enabled_override) if enabled_override is not None else base_enabled
        resolved_plugins.append(
            {
                "plugin_id": plugin_id,
                "category": plugin.get("category", "Other"),
                "display_name": plugin.get("display_name", plugin_id),
                "description": plugin.get("description", ""),
                "enabled": enabled,
                "default_enabled": base_enabled,
                "defaults": base_config,
                "overrides": override_config,
                "effective_config": effective_config,
                "read_only_sections": plugin.get("read_only_sections", []),
                "config_schema": plugin.get("config_schema", {}),
                "docs": plugin.get("docs", {}),
                "dependencies": plugin.get("dependencies", []),
                "runtime_hooks": plugin.get("runtime_hooks", []),
                "provides": plugin.get("provides", []),
                "requires": plugin.get("requires", []),
                "modifies": plugin.get("modifies", []),
                "conflicts": plugin.get("conflicts", []),
                "phase": plugin.get("phase", "qualification"),
            }
        )

    graph = resolve_plugin_execution_graph(resolved_plugins)
    return {
        "strategy": metadata,
        "plugins": resolved_plugins,
        "execution_order": graph["execution_order"],
        "graph_edges": graph["graph_edges"],
    }


def resolve_plugin_execution_graph(plugins: list[dict[str, Any]]) -> dict[str, Any]:
    enabled_plugins = [plugin for plugin in plugins if plugin.get("enabled")]
    provided_by_capability: dict[str, list[str]] = {}
    for plugin in enabled_plugins:
        for capability in plugin.get("provides", []):
            provided_by_capability.setdefault(str(capability), []).append(plugin["plugin_id"])

    graph_edges: dict[str, set[str]] = {plugin["plugin_id"]: set() for plugin in enabled_plugins}
    indegree: dict[str, int] = {plugin["plugin_id"]: 0 for plugin in enabled_plugins}

    for plugin in enabled_plugins:
        current_id = plugin["plugin_id"]
        current_phase_rank = PHASE_ORDER.get(str(plugin.get("phase", "qualification")), 999)
        for requirement in plugin.get("requires", []):
            providers = provided_by_capability.get(str(requirement), [])
            for provider_id in providers:
                if provider_id == current_id or current_id in graph_edges[provider_id]:
                    continue
                graph_edges[provider_id].add(current_id)
                indegree[current_id] += 1

        for other in enabled_plugins:
            other_id = other["plugin_id"]
            if other_id == current_id:
                continue
            other_phase_rank = PHASE_ORDER.get(str(other.get("phase", "qualification")), 999)
            if other_phase_rank < current_phase_rank and current_id not in graph_edges[other_id]:
                graph_edges[other_id].add(current_id)
                indegree[current_id] += 1

    ready = sorted([plugin_id for plugin_id, degree in indegree.items() if degree == 0])
    ordered: list[str] = []
    while ready:
        current = ready.pop(0)
        ordered.append(current)
        for child in sorted(graph_edges[current]):
            indegree[child] -= 1
            if indegree[child] == 0:
                ready.append(child)
                ready.sort()

    if len(ordered) != len(enabled_plugins):
        ordered = sorted(graph_edges.keys(), key=lambda plugin_id: (
            PHASE_ORDER.get(
                str(next((p.get("phase") for p in enabled_plugins if p["plugin_id"] == plugin_id), "qualification")),
                999,
            ),
            plugin_id,
        ))

    return {
        "execution_order": ordered,
        "graph_edges": {plugin_id: sorted(children) for plugin_id, children in graph_edges.items()},
    }


def validate_resolved_strategy_config(
    resolved: dict[str, Any],
    *,
    plugins_dir: Path | None = None,
    config_path: Path | None = None,
) -> dict[str, Any]:
    plugin_map = load_plugin_definition_map(plugins_dir)
    raw_strategy = load_strategy_yaml(config_path)
    raw_plugins = raw_strategy.get("plugins", {}) if isinstance(raw_strategy.get("plugins"), dict) else {}

    issues: list[StrategyValidationIssue] = []
    resolved_plugins = {plugin["plugin_id"]: plugin for plugin in resolved.get("plugins", [])}
    enabled_plugins = {plugin_id: plugin for plugin_id, plugin in resolved_plugins.items() if plugin.get("enabled")}
    provided_capabilities: dict[str, list[str]] = {}
    for plugin_id, plugin in enabled_plugins.items():
        for capability in plugin.get("provides", []):
            provided_capabilities.setdefault(str(capability), []).append(plugin_id)

    for plugin_id, plugin in resolved_plugins.items():
        schema = plugin.get("config_schema", {})
        effective = plugin.get("effective_config", {})
        raw_override = raw_plugins.get(plugin_id, {}) if isinstance(raw_plugins.get(plugin_id), dict) else {}
        override_config = raw_override.get("config", {}) if isinstance(raw_override.get("config"), dict) else {}

        for key in override_config:
            if key not in schema:
                issues.append(
                    StrategyValidationIssue(
                        plugin_id=plugin_id,
                        field=key,
                        level="error",
                        message=f"Unknown override field '{key}' for plugin '{plugin_id}'.",
                        source="override",
                    )
                )

        for key, field_schema in schema.items():
            value = effective.get(key)
            field_type = field_schema.get("type")
            if field_type == "integer" and not isinstance(value, int):
                issues.append(
                    StrategyValidationIssue(plugin_id, key, "error", "Expected integer value.", "schema")
                )
                continue
            if field_type == "number" and not isinstance(value, (int, float)):
                issues.append(
                    StrategyValidationIssue(plugin_id, key, "error", "Expected numeric value.", "schema")
                )
                continue
            if field_type == "boolean" and not isinstance(value, bool):
                issues.append(
                    StrategyValidationIssue(plugin_id, key, "error", "Expected boolean value.", "schema")
                )
                continue
            if field_type == "string" and not isinstance(value, str):
                issues.append(
                    StrategyValidationIssue(plugin_id, key, "error", "Expected string value.", "schema")
                )
                continue
            if field_type == "array" and not isinstance(value, list):
                issues.append(
                    StrategyValidationIssue(plugin_id, key, "error", "Expected list value.", "schema")
                )
                continue

            minimum = field_schema.get("min")
            maximum = field_schema.get("max")
            if isinstance(value, (int, float)) and minimum is not None and value < minimum:
                issues.append(
                    StrategyValidationIssue(plugin_id, key, "error", f"Value must be >= {minimum}.", "schema")
                )
            if isinstance(value, (int, float)) and maximum is not None and value > maximum:
                issues.append(
                    StrategyValidationIssue(plugin_id, key, "error", f"Value must be <= {maximum}.", "schema")
                )

        if plugin.get("enabled"):
            for dependency in plugin.get("dependencies", []):
                dep_id = str(dependency)
                dep_plugin = resolved_plugins.get(dep_id)
                if dep_plugin is None or not dep_plugin.get("enabled"):
                    issues.append(
                        StrategyValidationIssue(
                            plugin_id=plugin_id,
                            field=None,
                            level="error",
                            message=f"Plugin '{plugin_id}' requires enabled dependency '{dep_id}'.",
                            source="dependency",
                        )
                    )
            for requirement in plugin.get("requires", []):
                providers = provided_capabilities.get(str(requirement), [])
                if not providers:
                    issues.append(
                        StrategyValidationIssue(
                            plugin_id=plugin_id,
                            field=None,
                            level="error",
                            message=f"Plugin '{plugin_id}' requires capability '{requirement}' but no enabled plugin provides it.",
                            source="capability",
                        )
                    )
            for conflict in plugin.get("conflicts", []):
                if conflict in enabled_plugins:
                    issues.append(
                        StrategyValidationIssue(
                            plugin_id=plugin_id,
                            field=None,
                            level="error",
                            message=f"Plugin '{plugin_id}' conflicts with enabled plugin '{conflict}'.",
                            source="conflict",
                        )
                    )
                elif conflict in provided_capabilities:
                    issues.append(
                        StrategyValidationIssue(
                            plugin_id=plugin_id,
                            field=None,
                            level="error",
                            message=f"Plugin '{plugin_id}' conflicts with capability '{conflict}'.",
                            source="conflict",
                        )
                    )
            for capability in plugin.get("modifies", []):
                if capability not in provided_capabilities and capability not in KNOWN_INTERNAL_CAPABILITIES:
                    issues.append(
                        StrategyValidationIssue(
                            plugin_id=plugin_id,
                            field=None,
                            level="warning",
                            message=f"Plugin '{plugin_id}' modifies capability '{capability}' but no enabled plugin explicitly provides it.",
                            source="capability",
                        )
                    )

    return {
        "is_valid": not any(issue.level == "error" for issue in issues),
        "issues": [
            {
                "plugin_id": issue.plugin_id,
                "field": issue.field,
                "level": issue.level,
                "message": issue.message,
                "source": issue.source,
            }
            for issue in issues
        ],
        "execution_order": resolved.get("execution_order", []),
        "graph_edges": resolved.get("graph_edges", {}),
    }


def resolved_plugins_by_id(resolved: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {plugin["plugin_id"]: plugin for plugin in resolved.get("plugins", [])}


def resolved_to_legacy_strategy(resolved: dict[str, Any]) -> dict[str, Any]:
    strategy = resolved.get("strategy", {})
    plugins = resolved_plugins_by_id(resolved)

    trend = plugins.get("trend_filter", {})
    price_filter = plugins.get("price_filter", {})
    atr_filter = plugins.get("atr_filter", {})
    currency_filter = plugins.get("currency_filter", {})
    rs_filter = plugins.get("rs_filter", {})
    ranking = plugins.get("momentum_ranking", {})
    breakout = plugins.get("breakout_signal", {})
    pullback = plugins.get("pullback_signal", {})
    min_history = plugins.get("min_history_gate", {})
    sizing = plugins.get("atr_position_sizing", {})
    rr_gate = plugins.get("rr_gate", {})
    fee_gate = plugins.get("fee_gate", {})
    regime = plugins.get("regime_risk", {})
    social = plugins.get("social_overlay", {})
    intelligence = plugins.get("market_intelligence", {})
    breakeven = plugins.get("breakeven_management", {})
    trailing = plugins.get("trailing_management", {})
    time_exit = plugins.get("time_exit_management", {})

    trend_cfg = trend.get("effective_config", {})
    price_cfg = price_filter.get("effective_config", {})
    atr_cfg = atr_filter.get("effective_config", {})
    currency_cfg = currency_filter.get("effective_config", {})
    rs_cfg = rs_filter.get("effective_config", {})
    ranking_cfg = ranking.get("effective_config", {})
    breakout_cfg = breakout.get("effective_config", {})
    pullback_cfg = pullback.get("effective_config", {})
    history_cfg = min_history.get("effective_config", {})
    sizing_cfg = sizing.get("effective_config", {})
    rr_cfg = rr_gate.get("effective_config", {})
    fee_cfg = fee_gate.get("effective_config", {})
    regime_cfg = regime.get("effective_config", {})
    social_cfg = social.get("effective_config", {})
    intel_cfg = intelligence.get("effective_config", {})
    breakeven_cfg = breakeven.get("effective_config", {})
    trailing_cfg = trailing.get("effective_config", {})
    time_exit_cfg = time_exit.get("effective_config", {})

    return {
        "id": strategy.get("id", "default"),
        "name": strategy.get("name", "Default"),
        "description": strategy.get("description", ""),
        "module": strategy.get("module", "momentum"),
        "is_default": True,
        "created_at": "yaml",
        "updated_at": "yaml",
        "universe": {
            "trend": {
                "sma_fast": int(trend_cfg.get("sma_fast", 20)),
                "sma_mid": int(trend_cfg.get("sma_mid", 50)),
                "sma_long": int(trend_cfg.get("sma_long", 200)),
            },
            "vol": {
                "atr_window": int(atr_cfg.get("atr_window", 14)),
            },
            "mom": {
                "lookback_6m": int(ranking_cfg.get("lookback_6m", 126)),
                "lookback_12m": int(ranking_cfg.get("lookback_12m", 252)),
                "benchmark": str(ranking_cfg.get("benchmark", "SPY")),
            },
            "filt": {
                "min_price": float(price_cfg.get("min_price", 5.0)),
                "max_price": float(price_cfg.get("max_price", 500.0)),
                "max_atr_pct": float(atr_cfg.get("max_atr_pct", 15.0)),
                "require_trend_ok": bool(trend_cfg.get("require_trend_ok", True)),
                "require_rs_positive": bool(rs_cfg.get("require_rs_positive", False)),
                "currencies": list(currency_cfg.get("currencies", ["USD", "EUR"])),
            },
        },
        "ranking": {
            "w_mom_6m": float(ranking_cfg.get("w_mom_6m", 0.45)),
            "w_mom_12m": float(ranking_cfg.get("w_mom_12m", 0.35)),
            "w_rs_6m": float(ranking_cfg.get("w_rs_6m", 0.2)),
            "top_n": int(ranking_cfg.get("top_n", 100)),
        },
        "signals": {
            "breakout_lookback": int(breakout_cfg.get("breakout_lookback", 50)),
            "pullback_ma": int(pullback_cfg.get("pullback_ma", 20)),
            "min_history": int(history_cfg.get("min_history", 260)),
        },
        "risk": {
            "account_size": float(sizing_cfg.get("account_size", 50000.0)),
            "risk_pct": float(sizing_cfg.get("risk_pct", 0.01)),
            "max_position_pct": float(sizing_cfg.get("max_position_pct", 0.6)),
            "min_shares": int(sizing_cfg.get("min_shares", 1)),
            "k_atr": float(sizing_cfg.get("k_atr", 2.0)),
            "min_rr": float(rr_cfg.get("min_rr", 2.0)),
            "rr_target": float(rr_cfg.get("rr_target", 2.0)),
            "commission_pct": float(fee_cfg.get("commission_pct", 0.0)),
            "max_fee_risk_pct": float(fee_cfg.get("max_fee_risk_pct", 0.2)),
            "regime_enabled": bool(regime_cfg.get("enabled", False)),
            "regime_trend_sma": int(regime_cfg.get("regime_trend_sma", 200)),
            "regime_trend_multiplier": float(regime_cfg.get("regime_trend_multiplier", 0.5)),
            "regime_vol_atr_window": int(regime_cfg.get("regime_vol_atr_window", 14)),
            "regime_vol_atr_pct_threshold": float(regime_cfg.get("regime_vol_atr_pct_threshold", 6.0)),
            "regime_vol_multiplier": float(regime_cfg.get("regime_vol_multiplier", 0.5)),
        },
        "manage": {
            "breakeven_at_r": float(breakeven_cfg.get("breakeven_at_r", 1.0)),
            "trail_after_r": float(trailing_cfg.get("trail_after_r", 2.0)),
            "trail_sma": int(trailing_cfg.get("trail_sma", 20)),
            "sma_buffer_pct": float(trailing_cfg.get("sma_buffer_pct", 0.005)),
            "max_holding_days": int(time_exit_cfg.get("max_holding_days", 20)),
            "benchmark": str(time_exit_cfg.get("benchmark", ranking_cfg.get("benchmark", "SPY"))),
        },
        "social_overlay": {
            "enabled": bool(social_cfg.get("enabled", False)),
            "lookback_hours": int(social_cfg.get("lookback_hours", 24)),
            "attention_z_threshold": float(social_cfg.get("attention_z_threshold", 3.0)),
            "min_sample_size": int(social_cfg.get("min_sample_size", 20)),
            "negative_sent_threshold": float(social_cfg.get("negative_sent_threshold", -0.4)),
            "sentiment_conf_threshold": float(social_cfg.get("sentiment_conf_threshold", 0.7)),
            "hype_percentile_threshold": float(social_cfg.get("hype_percentile_threshold", 95.0)),
            "providers": list(social_cfg.get("providers", ["reddit"])),
            "sentiment_analyzer": str(social_cfg.get("sentiment_analyzer", "keyword")),
        },
        "market_intelligence": dict(intel_cfg),
        "plugins_runtime": {
            plugin["plugin_id"]: {
                "enabled": plugin["enabled"],
                "effective_config": plugin["effective_config"],
                "defaults": plugin["defaults"],
                "overrides": plugin["overrides"],
                "runtime_hooks": plugin["runtime_hooks"],
                "display_name": plugin["display_name"],
                "category": plugin["category"],
                "description": plugin["description"],
                "docs": plugin["docs"],
            }
            for plugin in resolved.get("plugins", [])
        },
    }
