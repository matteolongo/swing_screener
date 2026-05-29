"""Roadmap metadata for paid fundamentals providers.

EODHD and Twelve Data are planned Tier 2 candidates for broader fundamentals,
calendar, and news coverage. This module intentionally exposes metadata only:
it does not define provider classes, mutate provider registries, read
environment variables, or make network calls.

Runtime support must be added in a future implementation by creating tested
provider modules and explicitly adding their names to fundamentals config
validation.
"""

from __future__ import annotations

from typing import Final

PLANNED_VENDOR_PROVIDER_NAMES: Final[tuple[str, ...]] = ("eodhd", "twelve_data")

PLANNED_VENDOR_PROVIDER_DOMAINS: Final[dict[str, tuple[str, ...]]] = {
    "eodhd": ("eu_fundamentals", "global_calendar", "financial_news"),
    "twelve_data": ("global_fundamentals", "earnings_calendar", "dividends_calendar"),
}

RUNTIME_PROVIDER_REGISTRATION_ENABLED: Final[bool] = False

