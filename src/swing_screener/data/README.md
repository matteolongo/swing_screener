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

## Files

| File | Purpose |
|------|---------|
| `universe.py` | `load_universe_from_package()`, `load_universe_from_file()`, `apply_universe_filters()` |
| `market_data.py` | Legacy `fetch_ohlcv()` wrapper (backward-compat; prefer provider factory) |
| `ticker_info.py` | `get_ticker_info()` — name, sector, currency |
| `currency.py` | `detect_currency()` — USD vs EUR from ticker suffix |
| `providers/` | Abstract provider layer (factory, base, yfinance, alpaca) |

## Provider Configuration

The active provider is selected via `BrokerConfig`:

```python
from swing_screener.config import BrokerConfig
from swing_screener.data.providers import get_market_data_provider

# Explicit config
cfg = BrokerConfig(provider="yfinance")  # default
provider = get_market_data_provider(cfg)

# Load from environment variables
provider = get_market_data_provider()  # reads env vars below
```

| Environment Variable | Purpose |
|----------------------|---------|
| `SWING_SCREENER_PROVIDER` | `"yfinance"` (default) or `"alpaca"` |
| `ALPACA_API_KEY` | Alpaca API key (required for `"alpaca"`) |
| `ALPACA_SECRET_KEY` | Alpaca secret key (required for `"alpaca"`) |
| `ALPACA_PAPER` | `"true"` for paper trading endpoint (default: `true`) |

| Provider | Description |
|----------|-------------|
| `YfinanceProvider` | Yahoo Finance (default, no API key required) |
| `AlpacaDataProvider` | Alpaca Markets (professional, requires credentials) |

## Caching

OHLCV data is cached locally in Parquet format to avoid redundant downloads:
- **Location**: `.cache/market_data/`
- **Format**: One `.parquet` file per ticker
- **Invalidation**: Pass `force_refresh=True` to bypass cache
- **Ticker metadata**: `.cache/ticker_meta.json`

## Universes

Packaged universes are CSV files embedded in the package under `data/universes/`:

```python
tickers = load_universe_from_package("usd_defense_all")
tickers = load_universe_from_package("eur_amsterdam_all")
tickers = load_universe_from_file("my_custom_list.csv")
```

Universe names follow the pattern `{currency}_{category}_{scope}`. Aliases are defined in `universes/manifest.json`. See `universes/README.md` for the full naming convention and available universes.

## Universe Filtering

```python
from swing_screener.data.universe import UniverseConfig, load_universe_from_package, apply_universe_filters

cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True)
tickers = load_universe_from_package("usd_all", cfg)

# Filters are also applied in selection/universe.py as part of build_feature_table()
```

## Notes

- `fetch_ohlcv()` in `market_data.py` is a backward-compatibility wrapper. New code should use `get_market_data_provider()` directly.
- `detect_currency()` uses ticker suffix heuristics (e.g., `.AS` → EUR, no suffix → USD).
- `BrokerConfig.from_env()` is called automatically when no config is passed to the factory.
