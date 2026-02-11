# Broker Integration Guide

This document explains how to configure and use different market data providers in swing_screener.

## Overview

Swing Screener supports multiple market data providers through a pluggable abstraction layer:
- **yfinance** (default): Free historical data from Yahoo Finance
- **Alpaca**: Historical and live data from Alpaca Markets (paper or live trading)

All providers return data in the same standardized format, so switching between them requires only configuration changes.

---

## Quick Start

### Using Default Provider (yfinance)

No configuration needed - yfinance is used by default:

```python
from swing_screener.data.providers import get_default_provider

provider = get_default_provider()
df = provider.fetch_ohlcv(
    tickers=["AAPL", "MSFT"],
    start_date="2024-01-01",
    end_date="2024-12-31"
)
```

### Using Alpaca Provider

1. **Get Alpaca API Keys**:
   - Sign up at https://app.alpaca.markets/signup
   - Go to paper trading account
   - Generate API keys (View > Generate API Keys)

2. **Set Environment Variables**:
   ```bash
   export ALPACA_API_KEY="your_api_key_here"
   export ALPACA_SECRET_KEY="your_secret_key_here"
   export SWING_SCREENER_PROVIDER="alpaca"  # Optional, defaults to yfinance
   export ALPACA_PAPER="true"  # Optional, defaults to true (paper trading)
   ```

3. **Use the Provider**:
   ```python
   from swing_screener.data.providers import get_default_provider
   
   provider = get_default_provider()  # Reads from environment
   df = provider.fetch_ohlcv(
       tickers=["AAPL", "MSFT"],
       start_date="2024-01-01",
       end_date="2024-12-31"
   )
   ```

---

## Configuration

### Environment Variables

The system reads the following environment variables:

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `SWING_SCREENER_PROVIDER` | Market data provider | `yfinance` | `yfinance`, `alpaca` |
| `ALPACA_API_KEY` | Alpaca API key | None | Your Alpaca API key |
| `ALPACA_SECRET_KEY` | Alpaca secret key | None | Your Alpaca secret key |
| `ALPACA_PAPER` | Use paper trading | `true` | `true`, `false` |

### Programmatic Configuration

You can also configure providers programmatically:

```python
from swing_screener.config import BrokerConfig
from swing_screener.data.providers import get_market_data_provider

# Yfinance
config = BrokerConfig(provider="yfinance")
provider = get_market_data_provider(config)

# Alpaca
config = BrokerConfig(
    provider="alpaca",
    alpaca_api_key="your_key",
    alpaca_secret_key="your_secret",
    alpaca_paper=True
)
provider = get_market_data_provider(config)
```

---

## Provider Comparison

### yfinance (Yahoo Finance)

**Pros**:
- ✅ Free, no API keys required
- ✅ Comprehensive historical data
- ✅ Wide coverage (all US equities + international)
- ✅ Caching built-in

**Cons**:
- ❌ Historical data only (no real-time prices)
- ❌ Rate limits (unofficial, can be unstable)
- ❌ No official API guarantee

**Best For**:
- Daily swing trading workflow
- Backtesting
- Free / hobby use

---

### Alpaca

**Pros**:
- ✅ Official API with SLA
- ✅ Real-time and historical data
- ✅ Free tier available (paper trading)
- ✅ Rate limiting: 200 requests/minute
- ✅ Can integrate with live/paper trading

**Cons**:
- ❌ Requires account signup
- ❌ API keys management
- ❌ US equities only
- ❌ Limited metadata (no sector/industry info)

**Best For**:
- Production systems
- Live trading integration
- Reliable data quality
- Future broker integration

---

## Data Format

All providers return data in the same standardized format:

### OHLCV DataFrame

```python
df = provider.fetch_ohlcv(
    tickers=["AAPL", "MSFT"],
    start_date="2024-01-01",
    end_date="2024-12-31",
    interval="1d"  # 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo
)
```

**Format**:
- **Index**: DatetimeIndex (trading days)
- **Columns**: MultiIndex with levels `(field, ticker)`
  - Fields: `Open`, `High`, `Low`, `Close`, `Volume`

**Example**:
```
                   Open              High              Low               Close             Volume
            AAPL    MSFT    AAPL    MSFT    AAPL    MSFT    AAPL    MSFT    AAPL        MSFT
2024-01-02  185.50  375.10  187.20  377.50  185.00  374.50  186.50  376.80  50000000    30000000
2024-01-03  186.00  376.00  188.50  378.00  185.50  375.00  187.50  377.20  48000000    28000000
```

### Latest Price

```python
price = provider.fetch_latest_price("AAPL")
# Returns: 186.50 (float)
```

### Ticker Metadata

```python
info = provider.get_ticker_info("AAPL")
# Returns: {
#     "name": "Apple Inc.",
#     "sector": "Technology",
#     "industry": "Consumer Electronics",
#     "market_cap": 2800000000000,
#     "currency": "USD",
#     "exchange": "NASDAQ"
# }
```

**Note**: Alpaca provides limited metadata. For full metadata, use yfinance or fall back to yfinance for ticker info.

---

## Advanced Usage

### Custom Provider Instances

```python
from swing_screener.data.providers import YfinanceProvider, AlpacaDataProvider

# Yfinance with custom cache
yf = YfinanceProvider(
    cache_dir=".cache/custom_market_data",
    auto_adjust=True,
    progress=True  # Show download progress
)

# Alpaca with custom settings
alpaca = AlpacaDataProvider(
    api_key="your_key",
    secret_key="your_secret",
    paper=True,
    cache_dir=".cache/alpaca",
    use_cache=True
)
```

### Caching

Both providers support caching:
- **yfinance**: Caches to `.cache/market_data/*.parquet`
- **Alpaca**: Caches to `.cache/alpaca_data/*.parquet`

Cache is automatically used on subsequent requests with same parameters.

### Rate Limiting (Alpaca)

Alpaca enforces 200 requests/minute. The provider handles this automatically with:
- Request tracking
- Automatic throttling
- Exponential backoff retry

---

## Integration with Existing Code

### CLI Integration

The CLI can be extended to support provider selection:

```bash
# Future enhancement
export SWING_SCREENER_PROVIDER=alpaca
python -m swing_screener.cli run --universe SP500
```

### API Integration

The FastAPI backend can read configuration from environment:

```python
# api/services/screener_service.py
from swing_screener.data.providers import get_default_provider

provider = get_default_provider()  # Reads from env
df = provider.fetch_ohlcv(tickers, start, end)
```

---

## Testing

### Unit Tests

Run provider tests:
```bash
pytest tests/data/test_providers.py -v
```

### Integration Tests with Alpaca

```bash
# Set up Alpaca keys
export ALPACA_API_KEY="your_key"
export ALPACA_SECRET_KEY="your_secret"

# Run integration tests
pytest tests/data/test_providers.py::TestAlpacaProvider::test_fetch_ohlcv_integration -v -m integration
```

### Test Both Providers Return Same Format

```bash
pytest tests/data/test_providers.py::TestProviderCompatibility -v
```

---

## Troubleshooting

### Date/Timezone Issues

**Problem**: Screener shows yesterday's data even after market close

**Solution** (Fixed in Feb 2026):
- Yfinance's `end` parameter is exclusive (doesn't include the end date)
- Provider now automatically adds +1 day to ensure current data is included
- After US market close (22:00 CET / 16:00 ET), screener correctly shows today's data
- To verify: Check the "Last Bar" column in screener results

---

### yfinance Issues

**Problem**: Download fails with `RuntimeError`
- **Solution**: Check internet connection, verify ticker symbols are valid, try with `use_cache=True` and `allow_cache_fallback_on_error=True`

**Problem**: Rate limit errors
- **Solution**: Enable caching, reduce request frequency, add delays between requests

---

### Alpaca Issues

**Problem**: `ModuleNotFoundError: No module named 'alpaca'`
- **Solution**: Install alpaca-py: `pip install alpaca-py`

**Problem**: `ValueError: Alpaca provider requires api_key and secret_key`
- **Solution**: Set `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` environment variables

**Problem**: `ConnectionError: Failed to fetch data from Alpaca`
- **Solution**: Check API keys, verify paper trading account is active, check Alpaca status page

**Problem**: Rate limit exceeded (429 errors)
- **Solution**: Reduce request frequency, provider automatically handles rate limiting with retries

---

## Migration Guide

### From Legacy market_data.py

If you're using the old `fetch_ohlcv()` function directly:

**Before**:
```python
from swing_screener.data.market_data import fetch_ohlcv, MarketDataConfig

cfg = MarketDataConfig(start="2024-01-01", end="2024-12-31")
df = fetch_ohlcv(["AAPL", "MSFT"], cfg=cfg)
```

**After**:
```python
from swing_screener.data.providers import get_default_provider

provider = get_default_provider()
df = provider.fetch_ohlcv(
    tickers=["AAPL", "MSFT"],
    start_date="2024-01-01",
    end_date="2024-12-31"
)
```

The old `fetch_ohlcv()` function still works and is wrapped by `YfinanceProvider`.

---

## Future Enhancements

Planned improvements:
- **Interactive Brokers** provider
- **Polygon.io** provider
- Live trading integration (Phase 2)
- Order execution via Alpaca Trading API (Phase 3)
- Automatic provider failover

---

## Security Considerations

### API Key Management

**DO**:
- ✅ Store API keys in environment variables
- ✅ Use `.env` file (add to `.gitignore`)
- ✅ Use separate paper/live keys
- ✅ Rotate keys periodically

**DON'T**:
- ❌ Commit API keys to git
- ❌ Hard-code keys in source code
- ❌ Share keys publicly
- ❌ Use live keys in development

### Example .env file

```bash
# .env (add to .gitignore!)
SWING_SCREENER_PROVIDER=alpaca
ALPACA_API_KEY=PKxxxxxxxxxxxxxxxx
ALPACA_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALPACA_PAPER=true
```

Load in Python:
```python
from dotenv import load_dotenv
load_dotenv()

from swing_screener.data.providers import get_default_provider
provider = get_default_provider()
```

---

## Support

For issues or questions:
- **Documentation**: See this guide and code comments
- **Tests**: Run `pytest tests/data/test_providers.py -v`
- **yfinance docs**: https://github.com/ranaroussi/yfinance
- **Alpaca docs**: https://alpaca.markets/docs/
- **Alpaca API status**: https://status.alpaca.markets/

---

**Last Updated**: February 2026
