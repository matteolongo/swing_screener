from __future__ import annotations

from dataclasses import dataclass, field
import os
from typing import Any

from swing_screener.utils import get_nested_dict

DEFAULT_INTEL_PROVIDERS = ("yahoo_finance",)
SUPPORTED_INTEL_PROVIDERS = {"yahoo_finance", "earnings_calendar"}
DEFAULT_EVIDENCE_SOURCES = (
    "yahoo_finance",
    "earnings_calendar",
    "sec_edgar",
    "company_ir_rss",
)
SUPPORTED_EVIDENCE_SOURCES = {
    "yahoo_finance",
    "earnings_calendar",
    "sec_edgar",
    "company_ir_rss",
    "exchange_announcements",
    "financial_news_rss",
    "calendar_fallback_scrape",
}
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
class SourceRateLimitConfig:
    requests_per_minute: int = 90
    max_concurrency: int = 4


@dataclass(frozen=True)
class SourceTimeoutConfig:
    connect_seconds: float = 5.0
    read_seconds: float = 20.0


@dataclass(frozen=True)
class SourcesConfig:
    enabled: tuple[str, ...] = DEFAULT_EVIDENCE_SOURCES
    scraping_enabled: bool = False
    allowed_domains: tuple[str, ...] = tuple()
    rate_limits: SourceRateLimitConfig = field(default_factory=SourceRateLimitConfig)
    timeouts: SourceTimeoutConfig = field(default_factory=SourceTimeoutConfig)


@dataclass(frozen=True)
class ScoringV2Weights:
    reaction_z_component: float = 0.22
    atr_shock_component: float = 0.12
    recency_component: float = 0.14
    proximity_component: float = 0.14
    materiality_component: float = 0.14
    source_quality_component: float = 0.10
    confirmation_component: float = 0.08
    filing_impact_component: float = 0.06
    uncertainty_penalty_component: float = 0.10


@dataclass(frozen=True)
class ScoringV2Config:
    enabled: bool = True
    weights: ScoringV2Weights = field(default_factory=ScoringV2Weights)
    low_evidence_confirmation_threshold: float = 0.25
    low_evidence_source_quality_threshold: float = 0.45
    stale_event_decay_hours: int = 120


@dataclass(frozen=True)
class CalendarConfig:
    binary_event_window_days: int = 3
    binary_event_min_materiality: float = 0.75
    binary_event_min_threshold_boost: float = 0.08
    low_evidence_min_threshold_boost: float = 0.06


@dataclass(frozen=True)
class LLMConfig:
    """LLM-based event classification configuration."""
    enabled: bool = False
    provider: str = "ollama"
    model: str = "mistral:7b-instruct"
    base_url: str = "http://localhost:11434"
    api_key: str = ""
    system_prompt: str = ""
    user_prompt_template: str = ""
    enable_cache: bool = True
    enable_audit: bool = True
    cache_path: str = "data/intelligence/llm_cache.json"
    audit_path: str = "data/intelligence/llm_audit"
    max_concurrency: int = 4
    education_template_version: str = "v1"
    education_style_level: str = "beginner"
    education_max_tokens: int = 450
    education_forbidden_claim_categories: tuple[str, ...] = (
        "prediction",
        "guarantee",
        "financial_advice",
    )
    education_recommendation_system_prompt: str = ""
    education_recommendation_user_prompt_template: str = ""
    education_thesis_system_prompt: str = ""
    education_thesis_user_prompt_template: str = ""
    education_learn_system_prompt: str = ""
    education_learn_user_prompt_template: str = ""


@dataclass(frozen=True)
class IntelligenceConfig:
    enabled: bool = False
    providers: tuple[str, ...] = DEFAULT_INTEL_PROVIDERS
    universe_scope: str = "screener_universe"
    market_context_symbols: tuple[str, ...] = DEFAULT_MARKET_CONTEXT_SYMBOLS
    symbol_states: tuple[str, ...] = DEFAULT_SYMBOL_STATES
    llm: LLMConfig = field(default_factory=LLMConfig)
    catalyst: CatalystConfig = field(default_factory=CatalystConfig)
    theme: ThemeConfig = field(default_factory=ThemeConfig)
    opportunity: OpportunityConfig = field(default_factory=OpportunityConfig)
    sources: SourcesConfig = field(default_factory=SourcesConfig)
    scoring_v2: ScoringV2Config = field(default_factory=ScoringV2Config)
    calendar: CalendarConfig = field(default_factory=CalendarConfig)


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


def _normalize_v2_weights(raw: dict[str, Any]) -> ScoringV2Weights:
    defaults = ScoringV2Weights()
    weights = ScoringV2Weights(
        reaction_z_component=_clean_ratio(raw.get("reaction_z_component"), defaults.reaction_z_component),
        atr_shock_component=_clean_ratio(raw.get("atr_shock_component"), defaults.atr_shock_component),
        recency_component=_clean_ratio(raw.get("recency_component"), defaults.recency_component),
        proximity_component=_clean_ratio(raw.get("proximity_component"), defaults.proximity_component),
        materiality_component=_clean_ratio(raw.get("materiality_component"), defaults.materiality_component),
        source_quality_component=_clean_ratio(raw.get("source_quality_component"), defaults.source_quality_component),
        confirmation_component=_clean_ratio(raw.get("confirmation_component"), defaults.confirmation_component),
        filing_impact_component=_clean_ratio(raw.get("filing_impact_component"), defaults.filing_impact_component),
        uncertainty_penalty_component=_clean_ratio(
            raw.get("uncertainty_penalty_component"),
            defaults.uncertainty_penalty_component,
        ),
    )

    positive_sum = (
        weights.reaction_z_component
        + weights.atr_shock_component
        + weights.recency_component
        + weights.proximity_component
        + weights.materiality_component
        + weights.source_quality_component
        + weights.confirmation_component
        + weights.filing_impact_component
    )
    if positive_sum <= 0:
        return defaults
    scale = 1.0 / positive_sum
    return ScoringV2Weights(
        reaction_z_component=round(weights.reaction_z_component * scale, 6),
        atr_shock_component=round(weights.atr_shock_component * scale, 6),
        recency_component=round(weights.recency_component * scale, 6),
        proximity_component=round(weights.proximity_component * scale, 6),
        materiality_component=round(weights.materiality_component * scale, 6),
        source_quality_component=round(weights.source_quality_component * scale, 6),
        confirmation_component=round(weights.confirmation_component * scale, 6),
        filing_impact_component=round(weights.filing_impact_component * scale, 6),
        uncertainty_penalty_component=round(weights.uncertainty_penalty_component, 6),
    )


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


def _resolve_llm_base_url(llm_raw: dict[str, Any], provider_name: str) -> str:
    configured = str(llm_raw.get("base_url", "")).strip()
    provider = str(provider_name).strip().lower()

    if provider == "openai":
        env_openai_base = str(os.environ.get("OPENAI_BASE_URL", "")).strip()
        if configured:
            return configured
        if env_openai_base:
            return env_openai_base
        return "https://api.openai.com/v1"

    env_ollama_host = str(os.environ.get("OLLAMA_HOST", "")).strip()

    if configured:
        # If strategy persisted the generic localhost default, prefer container/runtime override.
        if configured == "http://localhost:11434" and env_ollama_host and env_ollama_host != configured:
            return env_ollama_host
        return configured
    if env_ollama_host:
        return env_ollama_host
    return "http://localhost:11434"


def _resolve_llm_api_key(llm_raw: dict[str, Any], provider_name: str) -> str:
    configured = str(llm_raw.get("api_key", "")).strip()
    if configured:
        return configured
    if str(provider_name).strip().lower() == "openai":
        return str(os.environ.get("OPENAI_API_KEY", "")).strip()
    return ""


def _clean_prompt_override(raw: Any) -> str:
    if raw is None:
        return ""
    return str(raw).replace("\r\n", "\n").strip()


def _clean_csv_list(raw: Any, *, fallback: tuple[str, ...]) -> tuple[str, ...]:
    if raw is None:
        return fallback
    if isinstance(raw, str):
        values = [part.strip() for part in raw.split(",")]
    elif isinstance(raw, (list, tuple, set)):
        values = [str(part).strip() for part in raw]
    else:
        return fallback
    cleaned = tuple(value for value in values if value)
    return cleaned or fallback


def build_intelligence_config(strategy: dict) -> IntelligenceConfig:
    raw = get_nested_dict(strategy, "market_intelligence")
    catalyst_raw = get_nested_dict(raw, "catalyst")
    theme_raw = get_nested_dict(raw, "theme")
    opportunity_raw = get_nested_dict(raw, "opportunity")
    llm_raw = get_nested_dict(raw, "llm")
    sources_raw = get_nested_dict(raw, "sources")
    scoring_v2_raw = get_nested_dict(raw, "scoring_v2")
    scoring_v2_weights_raw = get_nested_dict(scoring_v2_raw, "weights")
    calendar_raw = get_nested_dict(raw, "calendar")

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

    llm_provider = str(llm_raw.get("provider", "ollama")).strip().lower()
    default_model = "gpt-4o-mini" if llm_provider == "openai" else "mistral:7b-instruct"

    return IntelligenceConfig(
        enabled=bool(raw.get("enabled", False)),
        providers=providers,
        universe_scope=universe_scope,
        market_context_symbols=market_context_symbols,
        symbol_states=DEFAULT_SYMBOL_STATES,
        llm=LLMConfig(
            enabled=bool(llm_raw.get("enabled", False)),
            provider=llm_provider,
            model=str(llm_raw.get("model", default_model)).strip(),
            base_url=_resolve_llm_base_url(llm_raw, llm_provider),
            api_key=_resolve_llm_api_key(llm_raw, llm_provider),
            system_prompt=_clean_prompt_override(llm_raw.get("system_prompt", "")),
            user_prompt_template=_clean_prompt_override(llm_raw.get("user_prompt_template", "")),
            enable_cache=bool(llm_raw.get("enable_cache", True)),
            enable_audit=bool(llm_raw.get("enable_audit", True)),
            cache_path=str(llm_raw.get("cache_path", "data/intelligence/llm_cache.json")).strip(),
            audit_path=str(llm_raw.get("audit_path", "data/intelligence/llm_audit")).strip(),
            max_concurrency=_clean_positive_int(llm_raw.get("max_concurrency"), 4),
            education_template_version=str(llm_raw.get("education_template_version", "v1")).strip() or "v1",
            education_style_level=str(llm_raw.get("education_style_level", "beginner")).strip() or "beginner",
            education_max_tokens=_clean_positive_int(llm_raw.get("education_max_tokens"), 450, min_value=64),
            education_forbidden_claim_categories=_clean_csv_list(
                llm_raw.get("education_forbidden_claim_categories"),
                fallback=("prediction", "guarantee", "financial_advice"),
            ),
            education_recommendation_system_prompt=_clean_prompt_override(
                llm_raw.get("education_recommendation_system_prompt", "")
            ),
            education_recommendation_user_prompt_template=_clean_prompt_override(
                llm_raw.get("education_recommendation_user_prompt_template", "")
            ),
            education_thesis_system_prompt=_clean_prompt_override(
                llm_raw.get("education_thesis_system_prompt", "")
            ),
            education_thesis_user_prompt_template=_clean_prompt_override(
                llm_raw.get("education_thesis_user_prompt_template", "")
            ),
            education_learn_system_prompt=_clean_prompt_override(
                llm_raw.get("education_learn_system_prompt", "")
            ),
            education_learn_user_prompt_template=_clean_prompt_override(
                llm_raw.get("education_learn_user_prompt_template", "")
            ),
        ),
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
        sources=SourcesConfig(
            enabled=_clean_string_list(
                sources_raw.get("enabled"),
                fallback=DEFAULT_EVIDENCE_SOURCES,
                allowed=SUPPORTED_EVIDENCE_SOURCES,
                normalize_upper=False,
            ),
            scraping_enabled=bool(sources_raw.get("scraping_enabled", False)),
            allowed_domains=_clean_csv_list(
                sources_raw.get("allowed_domains"),
                fallback=tuple(),
            ),
            rate_limits=SourceRateLimitConfig(
                requests_per_minute=_clean_positive_int(
                    get_nested_dict(sources_raw, "rate_limits").get("requests_per_minute"),
                    90,
                ),
                max_concurrency=_clean_positive_int(
                    get_nested_dict(sources_raw, "rate_limits").get("max_concurrency"),
                    4,
                ),
            ),
            timeouts=SourceTimeoutConfig(
                connect_seconds=_clean_non_negative_float(
                    get_nested_dict(sources_raw, "timeouts").get("connect_seconds"),
                    5.0,
                ),
                read_seconds=_clean_non_negative_float(
                    get_nested_dict(sources_raw, "timeouts").get("read_seconds"),
                    20.0,
                ),
            ),
        ),
        scoring_v2=ScoringV2Config(
            enabled=bool(scoring_v2_raw.get("enabled", True)),
            weights=_normalize_v2_weights(scoring_v2_weights_raw),
            low_evidence_confirmation_threshold=_clean_ratio(
                scoring_v2_raw.get("low_evidence_confirmation_threshold"),
                0.25,
            ),
            low_evidence_source_quality_threshold=_clean_ratio(
                scoring_v2_raw.get("low_evidence_source_quality_threshold"),
                0.45,
            ),
            stale_event_decay_hours=_clean_positive_int(
                scoring_v2_raw.get("stale_event_decay_hours"),
                120,
            ),
        ),
        calendar=CalendarConfig(
            binary_event_window_days=_clean_positive_int(
                calendar_raw.get("binary_event_window_days"),
                3,
            ),
            binary_event_min_materiality=_clean_ratio(
                calendar_raw.get("binary_event_min_materiality"),
                0.75,
            ),
            binary_event_min_threshold_boost=_clean_ratio(
                calendar_raw.get("binary_event_min_threshold_boost"),
                0.08,
            ),
            low_evidence_min_threshold_boost=_clean_ratio(
                calendar_raw.get("low_evidence_min_threshold_boost"),
                0.06,
            ),
        ),
    )
