from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from swing_screener.utils import get_nested_dict

DEFAULT_INTEL_PROVIDERS = ("yahoo_finance",)
SUPPORTED_INTEL_PROVIDERS = {"yahoo_finance", "earnings_calendar"}
SUPPORTED_UNIVERSE_SCOPES = {"screener_universe", "strategy_universe"}
DEFAULT_MARKET_CONTEXT_SYMBOLS = ("SPY", "QQQ", "XLK", "SMH", "XBI")
DEFAULT_SYMBOL_STATES = (
    "QUIET",
    "WATCH",
    "CATALYST_ACTIVE",
    "TRENDING",
    "COOLING_OFF",
)


@dataclass(frozen=True)
class CatalystConfig:
    lookback_hours: int = 72
    recency_half_life_hours: int = 36
    false_catalyst_return_z: float = 1.5
    min_price_reaction_atr: float = 0.8
    require_price_confirmation: bool = True


@dataclass(frozen=True)
class ThemeConfig:
    enabled: bool = True
    min_cluster_size: int = 3
    min_peer_confirmation: int = 2
    curated_peer_map_path: str = "data/intelligence/peer_map.yaml"


@dataclass(frozen=True)
class OpportunityConfig:
    technical_weight: float = 0.55
    catalyst_weight: float = 0.45
    max_daily_opportunities: int = 8
    min_opportunity_score: float = 0.55


@dataclass(frozen=True)
class IntelligenceConfig:
    enabled: bool = False
    providers: tuple[str, ...] = DEFAULT_INTEL_PROVIDERS
    universe_scope: str = "screener_universe"
    market_context_symbols: tuple[str, ...] = DEFAULT_MARKET_CONTEXT_SYMBOLS
    symbol_states: tuple[str, ...] = DEFAULT_SYMBOL_STATES
    catalyst: CatalystConfig = field(default_factory=CatalystConfig)
    theme: ThemeConfig = field(default_factory=ThemeConfig)
    opportunity: OpportunityConfig = field(default_factory=OpportunityConfig)


def _clean_positive_int(raw: Any, fallback: int, *, min_value: int = 1) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return fallback
    return value if value >= min_value else fallback


def _clean_non_negative_float(raw: Any, fallback: float) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return fallback
    return value if value >= 0 else fallback


def _clean_ratio(raw: Any, fallback: float) -> float:
    value = _clean_non_negative_float(raw, fallback)
    if value > 1:
        return fallback
    return value


def _normalize_weights(technical_weight: Any, catalyst_weight: Any) -> tuple[float, float]:
    technical = _clean_non_negative_float(technical_weight, 0.55)
    catalyst = _clean_non_negative_float(catalyst_weight, 0.45)
    if technical == 0 and catalyst == 0:
        return (0.55, 0.45)
    total = technical + catalyst
    if total <= 0:
        return (0.55, 0.45)
    return (technical / total, catalyst / total)


def _clean_string_list(
    raw: Any,
    *,
    fallback: tuple[str, ...],
    allowed: set[str] | None = None,
    normalize_upper: bool = False,
) -> tuple[str, ...]:
    if isinstance(raw, (list, tuple, set)):
        items = list(raw)
    elif raw is None:
        items = []
    else:
        items = [raw]

    cleaned: list[str] = []
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        text_norm = text.upper() if normalize_upper else text.lower()
        if allowed is not None and text_norm not in allowed:
            continue
        if text_norm not in cleaned:
            cleaned.append(text_norm)

    return tuple(cleaned) if cleaned else fallback


def build_intelligence_config(strategy: dict) -> IntelligenceConfig:
    raw = get_nested_dict(strategy, "market_intelligence")
    catalyst_raw = get_nested_dict(raw, "catalyst")
    theme_raw = get_nested_dict(raw, "theme")
    opportunity_raw = get_nested_dict(raw, "opportunity")

    providers = _clean_string_list(
        raw.get("providers"),
        fallback=DEFAULT_INTEL_PROVIDERS,
        allowed=SUPPORTED_INTEL_PROVIDERS,
        normalize_upper=False,
    )
    universe_scope_raw = str(raw.get("universe_scope", "screener_universe")).strip().lower()
    universe_scope = (
        universe_scope_raw
        if universe_scope_raw in SUPPORTED_UNIVERSE_SCOPES
        else "screener_universe"
    )
    market_context_symbols = _clean_string_list(
        raw.get("market_context_symbols"),
        fallback=DEFAULT_MARKET_CONTEXT_SYMBOLS,
        normalize_upper=True,
    )

    technical_weight, catalyst_weight = _normalize_weights(
        opportunity_raw.get("technical_weight"),
        opportunity_raw.get("catalyst_weight"),
    )

    return IntelligenceConfig(
        enabled=bool(raw.get("enabled", False)),
        providers=providers,
        universe_scope=universe_scope,
        market_context_symbols=market_context_symbols,
        symbol_states=DEFAULT_SYMBOL_STATES,
        catalyst=CatalystConfig(
            lookback_hours=_clean_positive_int(catalyst_raw.get("lookback_hours"), 72),
            recency_half_life_hours=_clean_positive_int(
                catalyst_raw.get("recency_half_life_hours"), 36
            ),
            false_catalyst_return_z=_clean_non_negative_float(
                catalyst_raw.get("false_catalyst_return_z"), 1.5
            ),
            min_price_reaction_atr=_clean_non_negative_float(
                catalyst_raw.get("min_price_reaction_atr"), 0.8
            ),
            require_price_confirmation=bool(
                catalyst_raw.get("require_price_confirmation", True)
            ),
        ),
        theme=ThemeConfig(
            enabled=bool(theme_raw.get("enabled", True)),
            min_cluster_size=_clean_positive_int(theme_raw.get("min_cluster_size"), 3),
            min_peer_confirmation=_clean_positive_int(
                theme_raw.get("min_peer_confirmation"), 2
            ),
            curated_peer_map_path=str(
                theme_raw.get("curated_peer_map_path", "data/intelligence/peer_map.yaml")
            ),
        ),
        opportunity=OpportunityConfig(
            technical_weight=round(technical_weight, 6),
            catalyst_weight=round(catalyst_weight, 6),
            max_daily_opportunities=_clean_positive_int(
                opportunity_raw.get("max_daily_opportunities"), 8
            ),
            min_opportunity_score=_clean_ratio(
                opportunity_raw.get("min_opportunity_score"), 0.55
            ),
        ),
    )

