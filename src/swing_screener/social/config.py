from __future__ import annotations

from dataclasses import dataclass

DEFAULT_SUBREDDITS = (
    "wallstreetbets",
    "stocks",
    "investing",
    "options",
)
DEFAULT_USER_AGENT = "swing-screener/1.0"
DEFAULT_RATE_LIMIT_PER_SEC = 1.0
DEFAULT_ATTENTION_LOOKBACK_DAYS = 60
DEFAULT_HYPE_LOOKBACK_DAYS = 60
DEFAULT_HYPE_FIXED_THRESHOLD = 5.0


@dataclass(frozen=True)
class SocialOverlayConfig:
    enabled: bool = False
    lookback_hours: int = 24
    attention_z_threshold: float = 3.0
    min_sample_size: int = 20
    negative_sent_threshold: float = -0.4
    sentiment_conf_threshold: float = 0.7
    hype_percentile_threshold: float = 95.0
