from __future__ import annotations

from dataclasses import dataclass
from swing_screener.settings import get_settings_manager

_SOCIAL_DEFAULTS = get_settings_manager().get_low_level_defaults_payload("social")


def _social_tuple(key: str, fallback: tuple[str, ...]) -> tuple[str, ...]:
    raw = _SOCIAL_DEFAULTS.get(key)
    if isinstance(raw, list):
        values = tuple(str(item).strip() for item in raw if str(item).strip())
        if values:
            return values
    return fallback


def _social_str(key: str, fallback: str) -> str:
    raw = str(_SOCIAL_DEFAULTS.get(key, fallback)).strip()
    return raw or fallback


def _social_float(key: str, fallback: float) -> float:
    try:
        return float(_SOCIAL_DEFAULTS.get(key, fallback))
    except (TypeError, ValueError):
        return fallback


def _social_int(key: str, fallback: int) -> int:
    try:
        return int(_SOCIAL_DEFAULTS.get(key, fallback))
    except (TypeError, ValueError):
        return fallback


DEFAULT_SUBREDDITS = _social_tuple("subreddits", (
    "wallstreetbets",
    "stocks",
    "investing",
    "options",
    "stockmarket",
    "securityanalysis",
    "valueinvesting",
    "pennystocks",
))
DEFAULT_USER_AGENT = _social_str("user_agent", "swing-screener/1.0")
DEFAULT_RATE_LIMIT_PER_SEC = _social_float("rate_limit_per_sec", 1.0)
DEFAULT_ATTENTION_LOOKBACK_DAYS = _social_int("attention_lookback_days", 60)
DEFAULT_HYPE_LOOKBACK_DAYS = _social_int("hype_lookback_days", 60)
DEFAULT_HYPE_FIXED_THRESHOLD = _social_float("hype_fixed_threshold", 5.0)
DEFAULT_CACHE_TTL_HOURS = _social_int("cache_ttl_hours", 6)

# Provider and sentiment analyzer defaults
DEFAULT_PROVIDERS = list(_social_tuple("default_providers", ("reddit",)))
DEFAULT_SENTIMENT_ANALYZER = _social_str("default_sentiment_analyzer", "keyword")


@dataclass(frozen=True)
class SocialOverlayConfig:
    enabled: bool = False
    lookback_hours: int = 24
    attention_z_threshold: float = 3.0
    min_sample_size: int = 20
    negative_sent_threshold: float = -0.4
    sentiment_conf_threshold: float = 0.7
    hype_percentile_threshold: float = 95.0
    providers: tuple[str, ...] = tuple(DEFAULT_PROVIDERS)
    sentiment_analyzer: str = DEFAULT_SENTIMENT_ANALYZER
