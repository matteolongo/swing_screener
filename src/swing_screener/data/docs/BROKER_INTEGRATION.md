# Broker / Market Data Integration

> Status: current.  
> Last reviewed: 2026-02-17.

## Providers
- `yfinance` (default)
- `alpaca`

## Configuration
Environment variables:
- `SWING_SCREENER_PROVIDER` (`yfinance` | `alpaca`)
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `ALPACA_PAPER` (`true` | `false`)

Programmatic config:
- `swing_screener.config.BrokerConfig`
- `swing_screener.data.providers.get_market_data_provider()`

## Core Interfaces
- `swing_screener.data.providers.base.MarketDataProvider`
- `fetch_ohlcv(tickers, start_date, end_date, interval)`
