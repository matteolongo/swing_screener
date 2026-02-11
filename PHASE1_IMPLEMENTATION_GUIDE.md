# Phase 1 Implementation Guide - Remaining Work

## Status
✅ Step 1.1: Added alpaca-py dependency
✅ Step 1.2: Created MarketDataProvider abstraction

## Remaining Steps (Estimated: 2-3 days)

### Step 1.3: Implement Yfinance Provider (wrapper)
Create `src/swing_screener/data/providers/yfinance_provider.py`
- Wrap existing `fetch_ohlcv()` logic from `market_data.py`
- Keep all caching behavior
- This becomes the default provider

### Step 1.4: Implement Alpaca Data Provider
Create `src/swing_screener/data/providers/alpaca_provider.py`
- Use alpaca-py SDK
- Convert Alpaca bars → MultiIndex DataFrame
- Handle rate limits (200 req/min)
- Add retry logic with exponential backoff
- Cache same as yfinance

### Step 1.5: Configuration System
Update `src/swing_screener/config.py`:
```python
@dataclass
class BrokerConfig:
    provider: str = "yfinance"  # "yfinance" | "alpaca"
    alpaca_api_key: Optional[str] = None
    alpaca_secret_key: Optional[str] = None
    alpaca_paper: bool = True
```

Load from environment variables:
- ALPACA_API_KEY
- ALPACA_SECRET_KEY
- SWING_SCREENER_PROVIDER (default: yfinance)

### Step 1.6: Provider Factory
Create `src/swing_screener/data/providers/factory.py`:
```python
def get_market_data_provider(config: BrokerConfig) -> MarketDataProvider:
    if config.provider == "yfinance":
        return YfinanceProvider()
    elif config.provider == "alpaca":
        return AlpacaDataProvider(...)
```

### Step 1.7: Update Data Service Layer
- Modify `src/swing_screener/data/market_data.py` to use factory
- Update `api/services/screener_service.py`
- Update `api/services/portfolio_service.py`

### Step 1.8: Testing
Create `tests/data/test_providers.py`:
- Test both providers return same format
- Test Alpaca paper account integration
- Mock Alpaca API for unit tests

### Step 1.9: Documentation
- Create `docs/BROKER_INTEGRATION.md`
- Document how to get Alpaca API keys
- Document configuration
- Update README.md

## Quick Start (For You)

1. **Get Alpaca API Keys** (5 minutes):
   - Sign up: https://app.alpaca.markets/signup
   - Go to paper trading account
   - Generate API keys
   - Save as environment variables

2. **Test Current Code**:
   ```bash
   cd /Users/matteo.longo/projects/randomness/trading/swing_screener
   pip install alpaca-py
   python -c "from swing_screener.data.providers.base import MarketDataProvider; print('✅ Abstraction loaded')"
   ```

3. **Continue Implementation**:
   Follow steps 1.3-1.9 above, or ask me to continue when ready!

## Commit What We Have So Far

```bash
git add -A
git commit -m "feat: Phase 1.1-1.2 - Add Alpaca dependency and provider abstraction

- Added alpaca-py>=0.22.0 to dependencies
- Created MarketDataProvider ABC with standard interface
- Set up providers package structure

Next: Implement YfinanceProvider and AlpacaDataProvider"
```

## Estimated Time
- Steps 1.3-1.4: 1-2 days (provider implementations)
- Steps 1.5-1.7: 0.5-1 day (config + integration)  
- Steps 1.8-1.9: 0.5-1 day (tests + docs)

**Total: 2-4 days depending on complexity**

---

Let me know when you're ready to continue and I'll implement the remaining steps!
