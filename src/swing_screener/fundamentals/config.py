from __future__ import annotations

from dataclasses import dataclass
from importlib.util import find_spec
from typing import Any

SUPPORTED_FUNDAMENTAL_PROVIDERS = {"sec_edgar", "yfinance", "degiro"}

# Ordered provider chain for the Tier 1 free-first stack.
# SEC EDGAR is tried first (US equities only); yfinance is the global fallback.
# DeGiro is included in the default chain only when its integration package is
# available in this checkout.
# Add new providers here when graduating to Tier 2 — this is the single source
# of truth referenced by both the domain config and the API validation layer.


def _degiro_integration_available() -> bool:
    """True only when the integration package is importable AND credentials are set.

    The source files are always present now, so package presence alone is not a
    useful gate: degiro should enter the default provider chain only when it can
    actually authenticate. Checking credentials keeps the chain clean (and the
    diagnostics panel honest) for environments without DEGIRO_* env vars.
    """
    try:
        specs_present = (
            find_spec("swing_screener.integrations.degiro.credentials") is not None
            and find_spec("swing_screener.integrations.degiro.client") is not None
        )
    except ModuleNotFoundError:
        return False
    if not specs_present:
        return False
    try:
        from swing_screener.integrations.degiro.credentials import credentials_configured
        return credentials_configured()
    except Exception:
        return False


TIER1_PROVIDERS: tuple[str, ...] = (
    ("sec_edgar", "degiro", "yfinance")
    if _degiro_integration_available()
    else ("sec_edgar", "yfinance")
)


@dataclass(frozen=True)
class FundamentalsConfig:
    enabled: bool = True
    providers: tuple[str, ...] = TIER1_PROVIDERS
    cache_ttl_hours: int = 24
    stale_after_days: int = 120
    compare_limit: int = 5


def _clean_positive_int(raw: Any, fallback: int, *, min_value: int = 1, max_value: int | None = None) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return fallback
    if value < min_value:
        return fallback
    if max_value is not None and value > max_value:
        return fallback
    return value


def _clean_provider_list(raw: Any) -> tuple[str, ...]:
    if isinstance(raw, (list, tuple, set)):
        items = list(raw)
    elif raw is None:
        items = []
    else:
        items = [raw]

    cleaned: list[str] = []
    for item in items:
        provider = str(item).strip().lower()
        if not provider or provider not in SUPPORTED_FUNDAMENTAL_PROVIDERS:
            continue
        if provider not in cleaned:
            cleaned.append(provider)
    return tuple(cleaned) if cleaned else TIER1_PROVIDERS


def build_fundamentals_config(raw_payload: dict[str, Any] | None = None) -> FundamentalsConfig:
    raw = raw_payload if isinstance(raw_payload, dict) else {}
    return FundamentalsConfig(
        enabled=bool(raw.get("enabled", True)),
        providers=_clean_provider_list(raw.get("providers")),
        cache_ttl_hours=_clean_positive_int(raw.get("cache_ttl_hours"), 24, min_value=1, max_value=168),
        stale_after_days=_clean_positive_int(raw.get("stale_after_days"), 120, min_value=30, max_value=730),
        compare_limit=_clean_positive_int(raw.get("compare_limit"), 5, min_value=2, max_value=10),
    )
