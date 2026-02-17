# Sentiment Analysis Plugin System

> **Status: Needs review.** Verify providers/analyzers against current implementation.  
> **Last Reviewed:** February 17, 2026.

## Overview

The swing screener now supports a pluggable sentiment analysis architecture that allows you to:
- **Choose between multiple data sources** (Reddit, Yahoo Finance, or both)
- **Select different sentiment analyzers** (keyword-based, VADER, or custom)
- **Extend the system** with your own providers and analyzers

## Capabilities

- Providers: Reddit and Yahoo Finance
- Analyzers: keyword-based and VADER (plus custom extensions)
- Caching of social data to reduce API load

## Architecture

### Social Data Providers

Providers fetch raw social/news data from external sources. Each provider implements the `SocialProvider` protocol:

```python
class SocialProvider(Protocol):
    name: str
    
    def fetch_events(
        self,
        start_dt: datetime,
        end_dt: datetime,
        symbols: list[str],
    ) -> list[SocialRawEvent]:
        ...
```

#### Available Providers

1. **Reddit Provider** (`reddit`)
   - Fetches posts from financial subreddits
   - Default subreddits: wallstreetbets, stocks, investing, options, etc.
   - Rate limited: 1 request/second
   - Caching: 6-hour TTL

2. **Yahoo Finance Provider** (`yahoo_finance`)
   - Fetches news headlines and summaries
   - Uses Yahoo Finance news API
   - Rate limited: 1 request/second
   - Caching: 6-hour TTL

### Sentiment Analyzers

Analyzers process text and return sentiment scores. Each analyzer implements the `SentimentAnalyzer` protocol:

```python
class SentimentAnalyzer(Protocol):
    name: str
    
    def analyze(self, text: str) -> SentimentResult:
        ...
```

#### Available Analyzers

1. **Keyword Analyzer** (`keyword`) - **Default**
   - Fast, deterministic, no external dependencies
   - Uses predefined positive/negative word lists
   - Best for: high-volume screening where speed matters

2. **VADER Analyzer** (`vader`)
   - More sophisticated NLP-based analysis
   - Handles negations, intensifiers, punctuation
   - Tuned for social media text
   - Requires: `pip install vaderSentiment`
   - Best for: improved accuracy on complex sentiment

## Configuration

### Via Code

```python
from swing_screener.social.config import SocialOverlayConfig

config = SocialOverlayConfig(
    enabled=True,
    providers=("reddit", "yahoo_finance"),  # Use both sources
    sentiment_analyzer="vader",  # Use VADER analyzer
    lookback_hours=24,
    min_sample_size=20,
)
```

### Via Analysis Function

```python
from swing_screener.social.analysis import analyze_social_symbol

result = analyze_social_symbol(
    "AAPL",
    lookback_hours=24,
    min_sample_size=20,
    provider_names=["reddit", "yahoo_finance"],  # Multiple providers
    sentiment_analyzer_name="vader",  # Choose analyzer
)

# Result includes:
# - sentiment_score: float (-1.0 to 1.0)
# - sentiment_confidence: float (0.0 to 1.0)
# - source_breakdown: dict (events per provider)
# - raw_events: list (recent events)
```

## Usage Examples

### Example 1: Reddit-only with keyword sentiment (default)

```python
from swing_screener.social.analysis import analyze_social_symbol

result = analyze_social_symbol(
    "TSLA",
    lookback_hours=24,
    min_sample_size=10,
    provider_names=["reddit"],
    sentiment_analyzer_name="keyword",
)

print(f"Sentiment: {result['sentiment_score']:.2f}")
print(f"Confidence: {result['sentiment_confidence']:.2f}")
print(f"Sample size: {result['sample_size']}")
```

### Example 2: Multi-source with VADER

```python
result = analyze_social_symbol(
    "NVDA",
    lookback_hours=48,
    min_sample_size=20,
    provider_names=["reddit", "yahoo_finance"],
    sentiment_analyzer_name="vader",
)

print("Source breakdown:")
for source, count in result['source_breakdown'].items():
    print(f"  {source}: {count} events")
```

### Example 3: Check available analyzers

```python
from swing_screener.social.sentiment.factory import list_available_analyzers

analyzers = list_available_analyzers()
print(f"Available analyzers: {analyzers}")
# Output: ['keyword', 'vader'] (if vaderSentiment is installed)
```

## Adding Custom Providers

### Step 1: Implement the Protocol

```python
from swing_screener.social.providers.base import SocialProvider
from swing_screener.social.models import SocialRawEvent

class MyCustomProvider:
    name = "my_provider"
    
    def __init__(self, cache, **kwargs):
        self.cache = cache
        # Initialize your data source
    
    def fetch_events(self, start_dt, end_dt, symbols):
        # Fetch data from your source
        events = []
        for symbol in symbols:
            # Your fetching logic here
            events.append(
                SocialRawEvent(
                    source=self.name,
                    symbol=symbol,
                    timestamp=datetime.utcnow(),
                    text="Your text here",
                    url="https://example.com",
                )
            )
        return events
```

### Step 2: Register in Factory

Edit `src/swing_screener/social/analysis.py`:

```python
def _provider_for(name: str, cache: SocialCache):
    if name == "reddit":
        return RedditProvider(...)
    elif name == "yahoo_finance":
        return YahooFinanceProvider(...)
    elif name == "my_provider":
        from my_module import MyCustomProvider
        return MyCustomProvider(cache)
    raise ValueError(f"Unsupported social provider: {name}")
```

## Adding Custom Sentiment Analyzers

### Step 1: Implement the Protocol

```python
from swing_screener.social.sentiment.base import SentimentResult

class MyCustomAnalyzer:
    name = "my_analyzer"
    
    def analyze(self, text: str) -> SentimentResult:
        # Your analysis logic here
        score = 0.0  # Calculate sentiment (-1.0 to 1.0)
        confidence = 0.5  # Calculate confidence (0.0 to 1.0)
        return SentimentResult(score, confidence)
```

### Step 2: Register in Factory

Edit `src/swing_screener/social/sentiment/factory.py`:

```python
def get_sentiment_analyzer(name: str):
    if name == "keyword":
        return KeywordSentimentAnalyzer()
    elif name == "vader":
        return VaderSentimentAnalyzer()
    elif name == "my_analyzer":
        from my_module import MyCustomAnalyzer
        return MyCustomAnalyzer()
    raise ValueError(f"Unknown sentiment analyzer: {name}")
```

## Integration with Strategy

Sentiment scores are integrated into the strategy confidence system via `SocialOverlayDecision`:

```python
from swing_screener.social.overlay import apply_overlay

decision = apply_overlay(
    daily_metrics,  # SocialDailyMetrics
    config,  # SocialOverlayConfig
)

# Decision includes:
# - risk_multiplier: Adjust position size risk
# - max_pos_multiplier: Adjust maximum position size
# - veto: Block trade entirely
# - review_required: Flag for manual review
# - reasons: Explanation of decisions
```

## Best Practices

1. **Start with defaults**: Use `keyword` analyzer and `reddit` provider first
2. **Test incrementally**: Add one provider at a time
3. **Monitor performance**: VADER is slower but more accurate
4. **Cache aggressively**: Both providers cache for 6 hours by default
5. **Combine sources**: Multiple providers give more comprehensive view
6. **Set realistic thresholds**: `min_sample_size=20` is a good starting point

## Performance Considerations

- **Keyword analyzer**: ~0.1ms per text
- **VADER analyzer**: ~1-2ms per text
- **Reddit API**: 1 request/second rate limit
- **Yahoo Finance API**: 1 request/second rate limit
- **Caching**: Reduces API calls by ~80% in typical usage

## Troubleshooting

### VADER not available

```bash
pip install vaderSentiment
```

### Network errors

- Check internet connection
- Verify API endpoints are accessible
- Check rate limits haven't been exceeded
- Review cached data in `data/social_cache/`

### Low sample sizes

- Increase `lookback_hours` (try 48 or 72)
- Add more providers
- Lower `min_sample_size` threshold (but less reliable)

## Future Extensions

Possible additions (not yet implemented):
- News API provider (NewsAPI.org, Finnhub, Alpha Vantage)
- FinBERT transformer-based analyzer
- LLM-based sentiment (OpenAI, Anthropic)
- Twitter/X integration
- Discord/Telegram channels
- SEC filing sentiment

See `ROADMAP.md` for planned features.
