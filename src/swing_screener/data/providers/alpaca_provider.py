"""Alpaca market data provider using alpaca-py SDK."""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
import time
import hashlib

import pandas as pd

from .base import MarketDataProvider
from swing_screener.data.source_health import DataSourceHealth, SourceDescriptor, ProbeResult
from swing_screener.data.providers._probe import ohlcv_canary_probe

import logging

logger = logging.getLogger(__name__)

# Alpaca serves US equities/ETFs only — it has no index data. Universe
# benchmarks are stored as index symbols (^NDX, ^GSPC, ...); map the US ones to
# tradeable ETF proxies so relative-strength keeps working. Indices without a
# proxy (foreign benchmarks) are dropped — Alpaca can't serve those universes
# anyway.
_INDEX_ETF_PROXIES = {
    "^NDX": "QQQ",
    "^GSPC": "SPY",
    "^DJI": "DIA",
    "^RUT": "IWM",
}


class AlpacaDataProvider(MarketDataProvider):
    """
    Alpaca market data provider.
    
    Uses alpaca-py SDK for historical and live market data.
    Supports both paper and live trading accounts.
    Implements rate limiting (200 requests/minute) and retry logic.
    """
    
    # Alpaca rate limit: 200 requests per minute
    RATE_LIMIT_REQUESTS = 200
    RATE_LIMIT_WINDOW = 60  # seconds
    
    # Retry configuration
    MAX_RETRIES = 3
    RETRY_DELAY_BASE = 1.0  # seconds
    
    def __init__(
        self,
        api_key: str,
        secret_key: str,
        paper: bool = True,
        cache_dir: str = ".cache/alpaca_data",
        use_cache: bool = True,
    ):
        """
        Initialize Alpaca data provider.
        
        Args:
            api_key: Alpaca API key
            secret_key: Alpaca secret key
            paper: Use paper trading account (default: True)
            cache_dir: Directory for parquet cache files
            use_cache: Enable caching (default: True)
        """
        from alpaca.data import StockHistoricalDataClient  # lazy: keeps module importable without alpaca-py

        self.api_key = api_key
        self.secret_key = secret_key
        self.paper = paper
        self.cache_dir = Path(cache_dir)
        self.use_cache = use_cache

        # Initialize Alpaca client
        self.client = StockHistoricalDataClient(api_key, secret_key)
        
        # Rate limiting state
        self._request_times: list[float] = []
        
        # Create cache directory
        if self.use_cache:
            self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_source_health(self) -> DataSourceHealth:
        return DataSourceHealth(
            provider=self.get_provider_name(),
            domain="market_data",
            status="ok",
            quality_score=0.75 if self.paper else 0.85,
            delay_policy="provider_plan_dependent",
            warnings=["paper_or_basic_plan_may_be_limited"] if self.paper else [],
        )
    
    def _wait_for_rate_limit(self):
        """Enforce rate limiting (200 requests/minute)."""
        now = time.time()
        # Remove requests older than the rate limit window
        self._request_times = [t for t in self._request_times if now - t < self.RATE_LIMIT_WINDOW]
        
        # If we've hit the limit, wait
        if len(self._request_times) >= self.RATE_LIMIT_REQUESTS:
            oldest = self._request_times[0]
            wait_time = self.RATE_LIMIT_WINDOW - (now - oldest)
            if wait_time > 0:
                time.sleep(wait_time)
                now = time.time()
        
        # Record this request
        self._request_times.append(now)
    
    def _retry_with_backoff(self, func, *args, **kwargs):
        """Execute function with exponential backoff retry logic."""
        for attempt in range(self.MAX_RETRIES):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if attempt == self.MAX_RETRIES - 1:
                    raise
                delay = self.RETRY_DELAY_BASE * (2 ** attempt)
                time.sleep(delay)
    
    def _cache_path(self, tickers: list[str], start_date: str, end_date: str, interval: str) -> Path:
        """Generate cache file path for given parameters."""
        key = f"{'-'.join(sorted(tickers))}__{start_date}__{end_date}__{interval}"
        if len(key) > 200:
            digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
            prefix = "-".join(tickers[:3])
            key = f"{prefix}__n={len(tickers)}__{start_date}__{end_date}__{interval}__{digest}"
        return self.cache_dir / f"{key}.parquet"
    
    def _parse_timeframe(self, interval: str):
        """Convert interval string to Alpaca TimeFrame."""
        from alpaca.data.timeframe import TimeFrame  # lazy
        interval_map = {
            "1m": TimeFrame.Minute,
            "1min": TimeFrame.Minute,
            "5m": TimeFrame(5, "Min"),
            "5min": TimeFrame(5, "Min"),
            "15m": TimeFrame(15, "Min"),
            "15min": TimeFrame(15, "Min"),
            "30m": TimeFrame(30, "Min"),
            "30min": TimeFrame(30, "Min"),
            "1h": TimeFrame.Hour,
            "1hr": TimeFrame.Hour,
            "1hour": TimeFrame.Hour,
            "1d": TimeFrame.Day,
            "1day": TimeFrame.Day,
            "1w": TimeFrame.Week,
            "1wk": TimeFrame.Week,
            "1week": TimeFrame.Week,
            "1mo": TimeFrame.Month,
            "1month": TimeFrame.Month,
        }
        tf = interval_map.get(interval.lower())
        if tf is None:
            raise ValueError(f"Unsupported interval: {interval}. Supported: {list(interval_map.keys())}")
        return tf
    
    def fetch_ohlcv(
        self,
        tickers: list[str],
        start_date: str,
        end_date: str,
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetch OHLCV data from Alpaca.
        
        Args:
            tickers: List of ticker symbols
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            interval: Bar interval (default: "1d")
            
        Returns:
            DataFrame with MultiIndex columns (field, ticker)
            
        Raises:
            ValueError: If invalid tickers or interval
            ConnectionError: If Alpaca API fails
        """
        if not tickers:
            raise ValueError("tickers list is empty")

        # Map index benchmarks to ETF proxies; drop unsupported indices. The
        # original index symbol is restored as a column copy after the fetch.
        proxy_to_index: dict[str, str] = {}
        request_tickers: list[str] = []
        for ticker in tickers:
            if ticker.startswith("^"):
                proxy = _INDEX_ETF_PROXIES.get(ticker)
                if proxy is None:
                    logger.warning(
                        "AlpacaDataProvider: no ETF proxy for index %s; dropping "
                        "(Alpaca has no index data)", ticker,
                    )
                    continue
                proxy_to_index[proxy] = ticker
                if proxy not in request_tickers:
                    request_tickers.append(proxy)
            elif ticker not in request_tickers:
                request_tickers.append(ticker)

        if not request_tickers:
            raise ValueError(
                f"No Alpaca-supported symbols in request {tickers}: Alpaca serves "
                "US equities/ETFs only and these indices have no ETF proxy."
            )

        end_dt = pd.Timestamp(end_date).date()
        is_live_edge_request = end_dt >= date.today()

        # Check cache first for historical windows only.
        # For "today/live-edge" requests, bypass stale same-day cache so
        # post-close bars are visible before local midnight.
        cache_file = self._cache_path(tickers, start_date, end_date, interval)
        if self.use_cache and cache_file.exists() and not is_live_edge_request:
            # Normalize on read too: parquet caches written before tz handling
            # was added are tz-aware and would not survive a merge with a
            # freshly-fetched tz-naive frame.
            return self._normalize_index_tz(pd.read_parquet(cache_file))
        
        # Parse timeframe
        timeframe = self._parse_timeframe(interval)
        
        # Convert dates to datetime
        start = pd.Timestamp(start_date)
        end = pd.Timestamp(end_date)
        
        # Fetch data from Alpaca
        def fetch():
            from alpaca.data.requests import StockBarsRequest  # lazy
            self._wait_for_rate_limit()
            request = StockBarsRequest(
                symbol_or_symbols=request_tickers,
                start=start,
                end=end,
                timeframe=timeframe,
            )
            return self.client.get_stock_bars(request)
        
        try:
            bars = self._retry_with_backoff(fetch)
        except Exception as e:
            raise ConnectionError(f"Failed to fetch data from Alpaca: {e}") from e
        
        # Convert to DataFrame
        df = bars.df
        
        if df.empty:
            raise ValueError(f"No data returned for tickers {tickers} from {start_date} to {end_date}")
        
        # Alpaca returns MultiIndex (symbol, timestamp) -> we need to reshape
        # to our format: DatetimeIndex with MultiIndex columns (field, ticker)
        df = self._convert_alpaca_format(df, request_tickers)

        # Restore index benchmarks by copying each ETF-proxy column under the
        # original index symbol (copy, not rename, so a proxy that is also a
        # requested constituent keeps both columns).
        for proxy, index_sym in proxy_to_index.items():
            for field in ("Open", "High", "Low", "Close", "Volume"):
                if (field, proxy) in df.columns:
                    df[(field, index_sym)] = df[(field, proxy)]

        # Cache result
        if self.use_cache:
            df.to_parquet(cache_file)
        
        return df
    
    def _convert_alpaca_format(self, df: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
        """
        Convert Alpaca DataFrame format to swing_screener format.
        
        Alpaca format:
            MultiIndex: (symbol, timestamp)
            Columns: open, high, low, close, volume, trade_count, vwap
            
        Target format:
            Index: DatetimeIndex (timestamp)
            Columns: MultiIndex (field, ticker) where field in [Open, High, Low, Close, Volume]
        """
        # Reset index to get symbol and timestamp as columns
        df = df.reset_index()
        
        # Rename columns to match our convention (capitalize)
        df = df.rename(columns={
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "volume": "Volume",
        })
        
        # Select only OHLCV columns
        ohlcv_fields = ["Open", "High", "Low", "Close", "Volume"]
        df = df[["symbol", "timestamp"] + ohlcv_fields]
        
        # Pivot to get MultiIndex columns (field, ticker)
        dfs = []
        for field in ohlcv_fields:
            pivot = df.pivot(index="timestamp", columns="symbol", values=field)
            # Add field level to column index
            pivot.columns = pd.MultiIndex.from_product([[field], pivot.columns])
            dfs.append(pivot)
        
        # Concatenate all fields
        result = pd.concat(dfs, axis=1)
        
        # Ensure all requested tickers are present (fill missing with NaN)
        all_cols = []
        for field in ohlcv_fields:
            for ticker in tickers:
                all_cols.append((field, ticker))
        result = result.reindex(columns=pd.MultiIndex.from_tuples(all_cols))
        
        # Sort by date
        result = result.sort_index()

        # Remove any duplicate timestamps
        result = result.loc[~result.index.duplicated(keep="last")]

        return self._normalize_index_tz(result)

    @staticmethod
    def _normalize_index_tz(df: pd.DataFrame) -> pd.DataFrame:
        """Return a tz-naive index (the OHLCV convention; yfinance returns
        tz-naive dates). Alpaca daily bars carry a tz-aware UTC stamp at 00:00
        ET; converting to ET then dropping tz yields the midnight-naive trading
        date (and preserves wall-clock time for intraday intervals)."""
        if isinstance(df.index, pd.DatetimeIndex) and df.index.tz is not None:
            df.index = df.index.tz_convert("America/New_York").tz_localize(None)
        return df
    
    def fetch_latest_price(self, ticker: str) -> float:
        """
        Get latest price for a ticker from Alpaca.
        
        Args:
            ticker: Ticker symbol
            
        Returns:
            Latest price as float
            
        Raises:
            ValueError: If invalid ticker
            ConnectionError: If Alpaca API fails
        """
        # Fetch last 1 day of data to get latest close
        end = datetime.now()
        start = end - timedelta(days=5)  # Go back a few days to ensure we get data
        
        try:
            df = self.fetch_ohlcv(
                tickers=[ticker],
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                interval="1d"
            )
            
            if df.empty:
                raise ValueError(f"No data available for {ticker}")
            
            # Get latest close price
            latest_close = df[("Close", ticker)].dropna().iloc[-1]
            return float(latest_close)
        except Exception as e:
            raise ConnectionError(f"Failed to fetch latest price for {ticker}: {e}") from e
    
    def get_ticker_info(self, ticker: str) -> dict:
        """
        Get ticker metadata from Alpaca.
        
        Args:
            ticker: Ticker symbol
            
        Returns:
            Dictionary with metadata (name, sector, industry, market_cap)
            
        Note:
            Alpaca's data API has limited metadata. For full info,
            consider falling back to yfinance or using Alpaca's trading API.
        """
        # Alpaca's StockHistoricalDataClient doesn't provide company metadata
        # We return minimal info and recommend using yfinance for detailed metadata
        return {
            "name": ticker,
            "sector": None,
            "industry": None,
            "market_cap": None,
            "currency": "USD",  # Alpaca trades US equities
            "exchange": "Alpaca",
        }
    
    def is_market_open(self) -> bool:
        """
        Check if market is open.
        
        Returns:
            Market open status from Alpaca
            
        Note:
            This requires the trading API client, not just data API.
            For simplicity, returns False. Can be enhanced with TradingClient.
        """
        # Would need TradingClient to check clock.is_open
        # For now, return False (conservatively assume closed)
        return False
    
    def get_provider_name(self) -> str:
        """
        Get provider name.

        Returns:
            "alpaca" or "alpaca-paper"
        """
        return "alpaca-paper" if self.paper else "alpaca"

    @classmethod
    def _credentials_present(cls) -> bool:
        return bool(os.environ.get("ALPACA_API_KEY") and os.environ.get("ALPACA_SECRET_KEY"))

    @classmethod
    def describe(cls) -> SourceDescriptor:
        return SourceDescriptor(
            id="alpaca",
            display_name="Alpaca",
            domain="market_data",
            role="primary",
            requires="ALPACA_API_KEY",
            configured=cls._credentials_present(),
            probeable=True,
            canary_market="us",
        )

    @classmethod
    def probe(cls, canary: str) -> ProbeResult:
        if not cls._credentials_present():
            return ProbeResult(id="alpaca", status="not_configured", detail="ALPACA_API_KEY/SECRET not set")
        try:
            provider = cls(
                api_key=os.environ["ALPACA_API_KEY"],
                secret_key=os.environ["ALPACA_SECRET_KEY"],
                paper=os.environ.get("ALPACA_PAPER", "true").lower() != "false",
            )
        except ModuleNotFoundError:
            return ProbeResult(id="alpaca", status="not_configured", detail="alpaca-py not installed")
        return ohlcv_canary_probe(provider, canary, "alpaca")
