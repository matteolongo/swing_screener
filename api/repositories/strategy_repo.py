"""Strategy repository."""
from __future__ import annotations

from swing_screener.strategy.plugin_system import (
    resolve_strategy_config,
    resolved_to_legacy_strategy,
    load_plugin_definitions,
    validate_resolved_strategy_config,
)


DEFAULT_STRATEGY_ID = "default"


def _flatten_config(prefix: str, value) -> dict[str, object]:
    if isinstance(value, dict):
        out: dict[str, object] = {}
        for key, child in value.items():
            next_prefix = f"{prefix}.{key}" if prefix else str(key)
            out.update(_flatten_config(next_prefix, child))
        return out
    return {prefix: value}


def _doc_sections(docs: dict) -> list[dict]:
    if not isinstance(docs, dict):
        return []
    labels = {
        "what_it_is": "What It Is",
        "why_it_matters": "Why It Matters",
        "how_it_affects_trades": "How It Affects Trades",
        "tradeoffs": "Tradeoffs",
        "default_guidance": "Default Guidance",
        "danger_zone": "Danger Zone",
        "pro_tip": "Pro Tip",
    }
    sections: list[dict] = []
    for key, title in labels.items():
        value = str(docs.get(key, "")).strip()
        if value:
            sections.append({"title": title, "body": value})
    return sections


def _depends_on(plugin_id: str, graph_edges: dict[str, list[str]]) -> list[str]:
    dependencies: list[str] = []
    for source, targets in graph_edges.items():
        if plugin_id in targets:
            dependencies.append(source)
    return sorted(dependencies)


def _validation_payload(result: dict) -> dict:
    warnings = []
    for issue in result.get("issues", []):
        level = issue.get("level", "warning")
        mapped = "danger" if level == "error" else level
        field = issue.get("field")
        parameter = f"{issue['plugin_id']}.{field}" if field else issue["plugin_id"]
        warnings.append(
            {
                "parameter": parameter,
                "level": mapped,
                "message": issue.get("message", ""),
            }
        )
    danger_count = sum(1 for item in warnings if item["level"] == "danger")
    warning_count = sum(1 for item in warnings if item["level"] == "warning")
    info_count = sum(1 for item in warnings if item["level"] == "info")
    safety_score = max(0, min(100, 100 - danger_count * 15 - warning_count * 8 - info_count * 3))
    safety_level = (
        "beginner-safe"
        if safety_score >= 85
        else "requires-discipline"
        if safety_score >= 70
        else "expert-only"
    )
    return {
        "is_valid": result.get("is_valid", False),
        "warnings": warnings,
        "safety_score": safety_score,
        "safety_level": safety_level,
        "total_warnings": len(warnings),
        "danger_count": danger_count,
        "warning_count": warning_count,
        "info_count": info_count,
    }


class StrategyRepository:
    def list_strategies(self) -> list[dict]:
        return [self.get_active_strategy()]

    def get_strategy(self, strategy_id: str) -> dict | None:
        strategy = self.get_active_strategy()
        return strategy if strategy.get("id") == strategy_id else None

    def get_active_strategy(self) -> dict:
        return resolved_to_legacy_strategy(resolve_strategy_config())

    def set_active_strategy_id(self, strategy_id: str) -> None:
        raise NotImplementedError("Strategy activation is not supported in YAML read-only mode.")

    def save_strategies(self, strategies: list[dict]) -> None:
        raise NotImplementedError("Strategy editing is not supported in YAML read-only mode.")

    def get_active_strategy_id(self) -> str:
        return self.get_active_strategy().get("id", DEFAULT_STRATEGY_ID)

    def get_resolved_config(self) -> dict:
        resolved = resolve_strategy_config()
        strategy = resolved.get("strategy", {})
        graph_edges = resolved.get("graph_edges", {})
        plugins = []
        for plugin in resolved.get("plugins", []):
            defaults_flat = _flatten_config("", plugin.get("defaults", {}))
            effective_flat = _flatten_config("", plugin.get("effective_config", {}))
            schema = plugin.get("config_schema", {})
            keys = sorted(set(defaults_flat) | set(effective_flat) | set(schema))
            values = []
            for key in keys:
                field_schema = schema.get(key, {}) if isinstance(schema, dict) else {}
                values.append(
                    {
                        "key": key,
                        "label": field_schema.get("label", key),
                        "description": field_schema.get("description"),
                        "type": field_schema.get("type"),
                        "default_value": defaults_flat.get(key),
                        "effective_value": effective_flat.get(key),
                        "overridden": key in _flatten_config("", plugin.get("overrides", {})),
                        "source": "root_override" if key in _flatten_config("", plugin.get("overrides", {})) else "plugin_default",
                    }
                )
            plugins.append(
                {
                    "id": plugin["plugin_id"],
                    "category": str(plugin.get("category", "education")).lower(),
                    "display_name": plugin.get("display_name", plugin["plugin_id"]),
                    "description": plugin.get("description", ""),
                    "enabled": plugin.get("enabled", False),
                    "default_enabled": bool(plugin.get("defaults", {}).get("enabled", False)),
                    "phase": plugin.get("phase", "qualification"),
                    "provides": [str(item) for item in plugin.get("provides", [])],
                    "requires": [str(item) for item in plugin.get("requires", [])],
                    "modifies": [str(item) for item in plugin.get("modifies", [])],
                    "conflicts": [str(item) for item in plugin.get("conflicts", [])],
                    "depends_on": _depends_on(plugin["plugin_id"], graph_edges),
                    "read_only_sections": _doc_sections(plugin.get("docs", {})),
                    "values": values,
                }
            )
        return {
            "name": strategy.get("name", "Default"),
            "description": strategy.get("description"),
            "module": strategy.get("module", "momentum"),
            "config_path": "config/strategy.yaml",
            "execution_order": resolved.get("execution_order", []),
            "graph_edges": graph_edges,
            "plugins": plugins,
        }

    def list_plugin_definitions(self) -> list[dict]:
        definitions = []
        for plugin in load_plugin_definitions():
            config_schema = plugin.get("config_schema", {})
            definitions.append(
                {
                    "id": plugin["id"],
                    "category": str(plugin.get("category", "education")).lower(),
                    "display_name": plugin.get("display_name", plugin["id"]),
                    "description": plugin.get("description", ""),
                    "enabled_by_default": bool(plugin.get("defaults", {}).get("enabled", False)),
                    "phase": plugin.get("phase", "qualification"),
                    "provides": [str(item) for item in plugin.get("provides", [])],
                    "requires": [str(item) for item in plugin.get("requires", [])],
                    "modifies": [str(item) for item in plugin.get("modifies", [])],
                    "conflicts": [str(item) for item in plugin.get("conflicts", [])],
                    "config_fields": [
                        {
                            "key": key,
                            "label": field.get("label", key),
                            "description": field.get("description"),
                            "type": field.get("type"),
                        }
                        for key, field in config_schema.items()
                    ],
                    "read_only_sections": _doc_sections(plugin.get("docs", {})),
                }
            )
        return definitions

    def validate_config(self) -> dict:
        raw_resolved = resolve_strategy_config()
        return _validation_payload(validate_resolved_strategy_config(raw_resolved))

    @property
    def default_strategy_id(self) -> str:
        return DEFAULT_STRATEGY_ID
