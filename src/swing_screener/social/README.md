# Social Module

Social sentiment analysis and overlay: Reddit/Yahoo Finance monitoring, attention metrics, and sentiment-based veto system.

## Quick Start

```python
from swing_screener.social.analysis import analyze_social_symbol
from swing_screener.social.config import SocialOverlayConfig

# Analyze a single symbol
result = analyze_social_symbol(
    "AAPL",
    lookback_hours=24,
    min_sample_size=20,
    provider_names=["reddit", "yahoo_finance"],
    sentiment_analyzer_name="vader",
)

print(result["sentiment_score"])   # float, negative = bearish
print(result["sample_size"])       # number of events analyzed
print(result["decision"])          # SocialOverlayDecision
```

```python
from swing_screener.social.overlay import apply_overlay
from swing_screener.social.cache import SocialCache

cfg = SocialOverlayConfig(
    enable=True,
    lookback_hours=24,
    attention_z_threshold=3.0,
    min_sample_size=20,
    negative_sent_threshold=-0.4,
    sentiment_conf_threshold=0.7,
    hype_percentile_threshold=95.0,
)
cache = SocialCache()
decisions = apply_overlay(metrics_list, cfg, cache)
```

## Architecture

```
social/
  analysis.py        ← run_social_overlay() / analyze_social_symbol() entry points
  overlay.py         ← apply_overlay() — applies thresholds, returns decisions
  metrics.py         ← compute_daily_metrics() — aggregates events into metrics
  models.py          ← SocialDailyMetrics, SocialOverlayDecision
  config.py          ← SocialOverlayConfig + module-level defaults
  cache.py           ← In-memory event cache (hype history, event dedup)
  providers/
    base.py          ← Provider protocol
    reddit.py        ← Reddit scraper (via PRAW)
    yahoo_finance.py ← Yahoo Finance news scraper
  sentiment/
    base.py          ← SentimentAnalyzer protocol
    keyword.py       ← Rule-based keyword analyzer (fast, no dependencies)
    vader.py         ← VADER NLP analyzer (requires vaderSentiment)
    factory.py       ← get_sentiment_analyzer(name)
  docs/
    SENTIMENT_PLUGIN_GUIDE.md ← how to add custom providers/analyzers
```

## Configuration

### `SocialOverlayConfig`
```python
@dataclass
class SocialOverlayConfig:
    enable:                   bool  = False
    lookback_hours:           int   = 24
    attention_z_threshold:    float = 3.0   # sigma above baseline → attention spike
    min_sample_size:          int   = 20    # below this: LOW_SAMPLE_SIZE_NO_ACTION
    negative_sent_threshold:  float = -0.4  # below this → NEG_SENTIMENT_RISK veto
    sentiment_conf_threshold: float = 0.7   # minimum confidence for sentiment signal
    hype_percentile_threshold: float = 95.0 # above 95th pct of history → HYPE_CROWDING
```

### Module-Level Defaults (`config.py`)
```python
DEFAULT_SUBREDDITS = [
    "wallstreetbets", "stocks", "investing", "options",
    "stockmarket", "securityanalysis", "valueinvesting", "pennystocks"
]
DEFAULT_USER_AGENT           = "swing-screener/1.0"
DEFAULT_RATE_LIMIT_PER_SEC   = 1.0
DEFAULT_ATTENTION_LOOKBACK_DAYS = 60
DEFAULT_HYPE_LOOKBACK_DAYS   = 60
DEFAULT_HYPE_FIXED_THRESHOLD = 5.0   # fallback when history < 20 samples
DEFAULT_CACHE_TTL_HOURS      = 6
```

## Overlay Decisions

`apply_overlay()` returns a list of `SocialOverlayDecision` objects. Each decision can carry one or more reasons:

| Reason | Condition | Implication |
|--------|-----------|-------------|
| `ATTENTION_SPIKE` | attention z-score > threshold | Unusual crowd activity — proceed with caution |
| `HYPE_CROWDING` | mention count > 95th pct of history | Crowded trade — reduce or skip |
| `NEG_SENTIMENT_RISK` | sentiment score < -0.4 | Negative sentiment — veto entry |
| `LOW_SAMPLE_SIZE_NO_ACTION` | sample_size < min_sample_size | Insufficient data — no action taken |

A decision with no reasons means the symbol passed all social checks.

## Sentiment Analyzers

| Analyzer | Description | Requires |
|----------|-------------|---------|
| `keyword` | Fast rule-based, matches bullish/bearish keywords | nothing |
| `vader` | VADER NLP compound score (-1 to +1) | `vaderSentiment` |

Select with `sentiment_analyzer_name="vader"` or `"keyword"`.

## Adding a Custom Provider or Analyzer

See `docs/SENTIMENT_PLUGIN_GUIDE.md` for the protocol interface and step-by-step guide.

## Notes

- Social overlay is **disabled by default** (`enable=False`) in `SocialOverlayConfig`.
- Reddit scraping requires `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` environment variables (PRAW credentials).
- When insufficient history exists for a symbol (`< 20 samples`), the `DEFAULT_HYPE_FIXED_THRESHOLD` (5 mentions) is used as the hype threshold fallback.

## See Also

- `strategy/plugins/social_overlay/` — strategy plugin that integrates this module
- `strategy/config.py` — `build_social_overlay_config()` builder
- `intelligence/` — LLM-powered catalyst analysis (complementary to social signals)
