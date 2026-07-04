from __future__ import annotations

from typing import Any

from swing_screener.settings import get_settings_manager


def intelligence_config_section(name: str) -> dict[str, Any]:
    """Return `config.<name>` from the intelligence document, or `{}` on any error.

    Single source of truth for reading a subsection of the intelligence config.
    Fail-soft: a missing or unreadable document yields an empty dict so callers
    degrade to their own defaults rather than raising.
    """
    try:
        doc = get_settings_manager().load_intelligence_document()
        section = doc.get("config", {}).get(name, {})
    except Exception:
        return {}
    return section or {}
