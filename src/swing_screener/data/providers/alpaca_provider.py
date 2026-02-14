"""Alpaca market data provider using alpaca-py SDK."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
import time
import hashlib

import pandas as pd
from alpaca.data import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame

from .base import MarketDataProvider


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
    
    def _parse_timeframe(self, interval: str) -> TimeFrame:
        """Convert interval string to Alpaca TimeFrame."""
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
        
        end_dt = pd.Timestamp(end_date).date()
        is_live_edge_request = end_dt >= date.today()

        # Check cache first for historical windows only.
        # For "today/live-edge" requests, bypass stale same-day cache so
        # post-close bars are visible before local midnight.
        cache_file = self._cache_path(tickers, start_date, end_date, interval)
        if self.use_cache and cache_file.exists() and not is_live_edge_request:
            return pd.read_parquet(cache_file)
        
        # Parse timeframe
        timeframe = self._parse_timeframe(interval)
        
        # Convert dates to datetime
        start = pd.Timestamp(start_date)
        end = pd.Timestamp(end_date)
        
        # Fetch data from Alpaca
        def fetch():
            self._wait_for_rate_limit()
            request = StockBarsRequest(
                symbol_or_symbols=tickers,
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
        df = self._convert_alpaca_format(df, tickers)
        
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
        
        return result
    
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
