from __future__ import annotations

from dataclasses import dataclass
from typing import Any

SUPPORTED_FUNDAMENTAL_PROVIDERS = {"sec_edgar", "yfinance"}

# Ordered provider chain for the Tier 1 free-first stack.
# SEC EDGAR is tried first (US equities only); yfinance covers EU/global fallback.
# Add new providers here when graduating to Tier 2 — this is the single source
# of truth referenced by both the domain config and the API validation layer.
TIER1_PROVIDERS: tuple[str, ...] = ("sec_edgar", "yfinance")


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
