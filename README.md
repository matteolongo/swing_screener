# Swing Screener

A modular, educational-first **swing trading screener and backtesting toolkit** written in Python.

The goal of this project is **not** to provide a black-box trading bot, but to build a
**clear, inspectable, and extensible pipeline** to:

- download and normalize market data
- compute technical features
- screen and rank instruments
- generate entry signals
- backtest strategies step by step

Each part of the pipeline is implemented as an **independent module**, so every concept
(data handling, indicators, signals, risk, backtesting) can be understood and tested in isolation.

This makes the project suitable for:
- learning systematic trading
- experimenting with swing strategies
- building intuition about what actually works (and what doesn’t)

---

## Project Philosophy

- **Modular by design**: every module has clear inputs and outputs
- **No hidden state**: everything is explicit and inspectable
- **Educational first**: clarity > cleverness
- **Incremental complexity**: start simple, add realism step by step
- **Backtesting-aware**: strategies are always validated historically

The project is intentionally built bottom-up:

data → features → signals → risk → backtesting

---

## Project Structure (work in progress)

```
swing_screener/
├─ src/
│  └─ swing_screener/
│     ├─ data/          # market data handling
│     ├─ indicators/    # technical indicators (next modules)
│     ├─ screeners/     # universe & ranking
│     ├─ signals/       # entry logic
│     ├─ risk/          # position sizing
│     ├─ backtest/      # backtesting engine
│     └─ reporting/     # reports & outputs
├─ tests/
└─ README.md
```

Modules are added progressively and documented here as the project evolves.

---

## Module 1 — Market Data (`data/market_data.py`)

### Purpose

Module 1 is responsible for **downloading, normalizing, and caching OHLCV market data**.

Its job is to provide the rest of the system with **clean, consistent price data**, hiding
all the quirks of the data source.

All other modules assume that:
- prices are aligned by date
- columns follow a consistent structure
- missing or malformed data is handled upstream

---

### Responsibilities

- Download daily OHLCV data using `yfinance`
- Normalize column structure into a **MultiIndex**:

  (field, ticker)

  where:
  - field ∈ {Open, High, Low, Close, Volume}
  - ticker ∈ {AAPL, MSFT, ...}

- Handle both:
  - single-ticker downloads
  - multi-ticker downloads
- Ensure deterministic column ordering
- Cache results locally using Parquet files
- Return data ready for indicator computation

---

### Public API

```python
fetch_ohlcv(
    tickers: Iterable[str],
    cfg: MarketDataConfig,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> pd.DataFrame
```

### Configuration

```python
@dataclass
class MarketDataConfig:
    start: str = "2022-01-01"
    end: Optional[str] = None
    auto_adjust: bool = True
    progress: bool = False
    cache_dir: str = ".cache/market_data"
```

---

### Output Format

The returned DataFrame:

- is indexed by date
- has **MultiIndex columns** `(field, ticker)`
- contains only the required fields
- has no duplicate dates
- may contain NaNs only where data is genuinely missing

Example columns:

```
('Open', 'AAPL'), ('High', 'AAPL'), ('Low', 'AAPL'), ('Close', 'AAPL'), ('Volume', 'AAPL')
('Open', 'MSFT'), ...
```

---

### Example Usage

```python
from swing_screener.data.market_data import fetch_ohlcv, MarketDataConfig

ohlcv = fetch_ohlcv(
    ["AAPL", "MSFT", "SPY"],
    MarketDataConfig(start="2023-01-01")
)

print(ohlcv.tail())
```

---

### Testing

Module 1 is covered by unit tests that verify:

- correct import and execution
- presence of MultiIndex columns
- expected fields and tickers

Tests can be run with:

```bash
python -m pytest tests/test_market_data.py
```

---

## Next Modules (planned)

- Module 2: Trend indicators (SMA, trend filters)
- Module 3: Volatility (ATR)
- Module 4: Momentum & relative strength
- Module 5: Universe filtering & ranking
- Module 6: Entry signals
- Module 7: Risk management & position sizing
- Module 8: Backtesting engine
- Module 9: Reporting & analysis

Each module will be added incrementally and documented in this README.
