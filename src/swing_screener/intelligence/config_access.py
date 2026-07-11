from __future__ import annotations

from copy import deepcopy
from math import ceil
from typing import Any

from swing_screener.settings import get_settings_manager


def _as_mapping(value: Any) -> dict[str, Any]:
    return deepcopy(value) if isinstance(value, dict) else {}


def _active_strategy() -> dict[str, Any]:
    """Load the active strategy without making intelligence callers own storage."""
    try:
        # Keep the import local to avoid an application-startup settings/storage
        # cycle. Storage also provides the deterministic deleted-strategy fallback.
        from swing_screener.strategy.storage import get_active_strategy

        return _as_mapping(get_active_strategy())
    except Exception:
        return {}


def effective_intelligence_config(
    *,
    global_config: dict[str, Any] | None = None,
    active_strategy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Resolve the runtime intelligence contract for the active strategy.

    Global configuration owns credentials, endpoint policy, timeouts, retries,
    tracing, source safety, and the deployment ``llm.analyzer_enabled`` kill
    switch. The active strategy owns advisory policy: enablement, permitted
    model/provider selection, evidence lookback/confirmation, theme policy, and
    opportunity policy. Missing or legacy strategy policy falls back safely to
    the global document instead of failing an in-flight request.
    """
    if global_config is None:
        try:
            document = get_settings_manager().load_intelligence_document()
            global_config = _as_mapping(_as_mapping(document).get("config"))
        except Exception:
            global_config = {}
    else:
        global_config = _as_mapping(global_config)

    resolved = deepcopy(global_config)
    strategy = _as_mapping(active_strategy) if active_strategy is not None else _active_strategy()
    market = _as_mapping(strategy.get("market_intelligence"))
    if not market:
        resolved["policy"] = {
            "strategy_id": strategy.get("id"),
            "enabled": bool(global_config.get("enabled", False)),
        }
        return resolved

    global_llm = _as_mapping(global_config.get("llm"))
    strategy_llm = _as_mapping(market.get("llm"))
    configured_provider = str(global_llm.get("provider", "openai")).strip().lower() or "openai"
    allowed_providers = global_llm.get("permitted_providers")
    if not isinstance(allowed_providers, list):
        # A deployment can explicitly permit more providers. Otherwise a strategy
        # cannot accidentally select a provider the deployment does not support.
        allowed_providers = [configured_provider]
    permitted = {str(value).strip().lower() for value in allowed_providers if str(value).strip()}
    selected_provider = str(strategy_llm.get("provider", configured_provider)).strip().lower()
    if selected_provider not in permitted:
        selected_provider = configured_provider

    selected_model = str(strategy_llm.get("model", "")).strip()
    llm = _as_mapping(global_llm)
    llm["provider"] = selected_provider
    if selected_model:
        # The policy chooses the model, while the global document continues to
        # govern request budgets and connection behavior for both LLM calls.
        llm["model"] = selected_model
        llm["web_search_model"] = selected_model
        llm["format_model"] = selected_model
    llm["enabled"] = bool(strategy_llm.get("enabled", True))
    resolved["llm"] = llm

    catalyst = _as_mapping(market.get("catalyst"))
    evidence = _as_mapping(global_config.get("evidence"))
    lookback_hours = catalyst.get("lookback_hours")
    if isinstance(lookback_hours, (int, float)) and not isinstance(lookback_hours, bool):
        # Evidence collection is day-based. Round up so a 25-hour strategy does
        # not silently lose the prior day's evidence.
        evidence["recency_window_days"] = max(1, int(ceil(float(lookback_hours) / 24)))
    resolved["evidence"] = evidence

    policy = {
        "strategy_id": strategy.get("id"),
        "enabled": bool(market.get("enabled", False)),
        "llm": {
            "enabled": llm["enabled"],
            "provider": selected_provider,
            "model": llm.get("model") or llm.get("web_search_model"),
        },
        "catalyst": catalyst,
        "theme": _as_mapping(market.get("theme")),
        "opportunity": _as_mapping(market.get("opportunity")),
    }
    resolved["policy"] = policy
    # This is deliberately strategy-only. The global deployment kill switch is
    # ``llm.analyzer_enabled`` and is never overridden here.
    resolved["enabled"] = policy["enabled"]
    return resolved


def intelligence_config_section(name: str) -> dict[str, Any]:
    """Return a resolved intelligence subsection, or ``{}`` on any error.

    Existing consumers use this compatibility helper, so all runtime settings
    are consistently resolved and callers cannot mutate shared configuration.
    """
    try:
        section = effective_intelligence_config().get(name, {})
    except Exception:
        return {}
    return _as_mapping(section)
