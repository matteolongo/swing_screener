# Data Module

Market data fetching, universe management, and provider abstractions.

## Quick Start

```python
# Load a universe of tickers
from swing_screener.data import load_universe_from_package, fetch_ohlcv

tickers = load_universe_from_package("usd_all")
print(f"Loaded {len(tickers)} tickers")

# Fetch OHLCV data (cached to .cache/market_data/)
df = fetch_ohlcv(tickers[:10], start="2024-01-01", end="2024-12-31")
print(df["Close"].tail())
```

```python
# Use the provider factory
from swing_screener.data.providers import get_market_data_provider

provider = get_market_data_provider()
df = provider.fetch_ohlcv(["AAPL", "MSFT"], "2024-01-01", "2024-12-31")
```

```python
# Get ticker metadata
from swing_screener.data import get_ticker_info, detect_currency

info = get_ticker_info("ASML")
print(info)  # {'name': 'ASML Holding', 'sector': 'Technology', 'currency': 'EUR'}

currency = detect_currency("ASML.AS")  # EUR
```

## Submodules

| Module | Description |
|--------|-------------|
| `universe` | Load/filter/save ticker universes from CSV or package |
| `market_data` | Legacy OHLCV fetching wrapper |
| `ticker_info` | Company metadata (name, sector, currency) |
| `currency` | Detect EUR/USD from ticker suffix |
| `providers` | Abstract data provider layer |

### Providers

| Provider | Description |
|----------|-------------|
| `YfinanceProvider` | Yahoo Finance (default, no API key needed) |
| `AlpacaDataProvider` | Alpaca Markets (requires alpaca-py) |

See `universes/README.md` for universe naming conventions and available universes.
