"""Yfinance market data provider - wraps existing market_data.py logic."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional
import pandas as pd
import yfinance as yf

from .base import MarketDataProvider
from ..market_data import fetch_ohlcv, MarketDataConfig, fetch_ticker_metadata


class YfinanceProvider(MarketDataProvider):
    """
    Yahoo Finance market data provider.
    
    Wraps existing fetch_ohlcv() logic from market_data.py.
    Maintains all caching behavior and is the default provider.
    """
    
    def __init__(
        self,
        cache_dir: str = ".cache/market_data",
        auto_adjust: bool = True,
        progress: bool = False,
    ):
        """
        Initialize Yfinance provider.
        
        Args:
            cache_dir: Directory for parquet cache files
            auto_adjust: Use adjusted prices (default: True)
            progress: Show download progress bar (default: False)
        """
        self.cache_dir = cache_dir
        self.auto_adjust = auto_adjust
        self.progress = progress
    
    def fetch_ohlcv(
        self,
        tickers: list[str],
        start_date: str,
        end_date: str,
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetch OHLCV data from Yahoo Finance.
        
        Args:
            tickers: List of ticker symbols
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format (inclusive)
            interval: Bar interval (default: "1d", yfinance supports 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
            
        Returns:
            DataFrame with MultiIndex columns (field, ticker)
            
        Raises:
            ValueError: If invalid tickers
            RuntimeError: If download fails
            
        Note:
            Yfinance's end parameter is exclusive, so we add 1 day to ensure
            end_date is included in the results.
        """
        # Yfinance end param is exclusive - add 1 day to include end_date.
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        end_dt_inclusive = end_dt + timedelta(days=1)
        end_date_adjusted = end_dt_inclusive.strftime("%Y-%m-%d")
        request_end = end_dt.date()
        today = date.today()
        # For "today/live-edge" requests, bypass stale same-day cache so users
        # don't have to wait for midnight to get post-close bars.
        force_refresh = request_end >= today
        
        cfg = MarketDataConfig(
            start=start_date,
            end=end_date_adjusted,
            auto_adjust=self.auto_adjust,
            progress=self.progress,
            cache_dir=self.cache_dir,
        )
        return fetch_ohlcv(tickers, cfg=cfg, use_cache=True, force_refresh=force_refresh)
    
    def fetch_latest_price(self, ticker: str) -> float:
        """
        Get latest price for a ticker from Yahoo Finance.
        
        Args:
            ticker: Ticker symbol
            
        Returns:
            Latest price as float
            
        Raises:
            ValueError: If invalid ticker
            ConnectionError: If download fails
        """
        try:
            tk = yf.Ticker(ticker)
            info = tk.fast_info
            # Try regularMarketPrice first, then previousClose
            price = getattr(info, "last_price", None)
            if price is None or pd.isna(price):
                # Fallback to previous close
                price = getattr(info, "previous_close", None)
            if price is None or pd.isna(price):
                raise ValueError(f"No price data available for {ticker}")
            return float(price)
        except Exception as e:
            raise ConnectionError(f"Failed to fetch latest price for {ticker}: {e}") from e
    
    def get_ticker_info(self, ticker: str) -> dict:
        """
        Get ticker metadata from Yahoo Finance.
        
        Args:
            ticker: Ticker symbol
            
        Returns:
            Dictionary with metadata (name, sector, industry, market_cap)
            
        Raises:
            ValueError: If invalid ticker
            ConnectionError: If download fails
        """
        try:
            # Use existing fetch_ticker_metadata for consistency
            df = fetch_ticker_metadata([ticker], use_cache=True)
            row = df.loc[ticker]
            
            # Get additional info from yfinance Ticker
            tk = yf.Ticker(ticker)
            info = tk.get_info()
            
            return {
                "name": row.get("name") or info.get("shortName") or info.get("longName"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "market_cap": info.get("marketCap"),
                "currency": row.get("currency"),
                "exchange": row.get("exchange"),
            }
        except Exception as e:
            raise ConnectionError(f"Failed to fetch ticker info for {ticker}: {e}") from e
    
    def is_market_open(self) -> bool:
        """
        Check if market is open.
        
        Returns:
            False (yfinance provides historical data only)
            
        Note:
            Yfinance is a historical data provider and doesn't provide
            real-time market status. Always returns False.
        """
        return False
    
    def get_provider_name(self) -> str:
        """
        Get provider name.
        
        Returns:
            "yfinance"
        """
        return "yfinance"
