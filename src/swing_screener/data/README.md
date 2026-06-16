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
| `universe.py` | `load_universe_from_package()`, `load_universe_from_file()`, `apply_universe_filters()`, registry refresh + `instrument_master.json` merge; also exposes generated auto-universes |
| `auto_universe.py` | Materialize discovered symbols into versioned runtime universes backed by `data/intelligence/auto_universes.json` |
| `universe_sources.py` | Source-adapter dispatch (`refresh_snapshot_from_source`): Euronext AEX-family and `wikipedia_index_review` |
| `wikipedia_sources.py` | Fetch + parse index constituent tables from Wikipedia; normalize tickers to Yahoo symbols |
| `instrument_enrichment.py` | Resolve a Yahoo symbol to an instrument-master record via yfinance `.info` (MIC, currency, country, timezone, type) |
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
- **Location**: `.cache/market_data/by_ticker/` (one `.parquet` file per ticker, plus `index.json` recording each ticker's covered date window)
- **Reuse**: a ticker is served from cache when its covered window contains the requested window, so universe membership changes never invalidate other tickers
- **Freshness**: windows ending today are reused within `same_day_cache_ttl_minutes` (default 15, see `data_providers.yfinance` in `config/defaults.yaml`); historical windows never expire
- **Invalidation**: pass `force_refresh=True` to bypass cache
- **Ticker metadata**: `.cache/ticker_meta.json`, company name/sector cache in `.cache/ticker_info.json`, earnings proximity cache in `.cache/earnings_days.json`

## Universes

Packaged universes are CSV files embedded in the package under `data/universes/`:

```python
tickers = load_universe_from_package("usd_defense_all")
tickers = load_universe_from_package("eur_amsterdam_all")
tickers = load_universe_from_file("my_custom_list.csv")
```

Universe names follow the pattern `{currency}_{category}_{scope}`. Aliases are defined in `universes/manifest.json`. See `universes/README.md` for the full naming convention and available universes.

Generated auto-universes are stored outside the packaged registry in
`data/intelligence/auto_universes.json` (or `SWING_SCREENER_AUTO_UNIVERSES_FILE`).
They are listed by the same universe APIs and can be passed to the screener like
packaged universe ids after `POST /api/universes/auto-refresh` materializes them.

## Index universe refresh

Index universes with a `source_adapter` (e.g. the `wikipedia_index_review` indices
`us_sp500`, `us_nasdaq100`, `us_dow30`, `germany_dax`, `france_cac40`, `uk_ftse100`,
`spain_ibex35`, `europe_eurostoxx50`) can be rebuilt from source:

```bash
python -m swing_screener.cli universes refresh --name us_sp500 --apply
```

`--apply` writes the snapshot and appends any newly enriched symbols to
`data/intelligence/instrument_master.json` (append-only, never overwrites). Omit
`--apply` for a dry-run preview. Symbols yfinance cannot resolve are skipped with a
note rather than failing the whole refresh.

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
