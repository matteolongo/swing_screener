"""Abstract base class for market data providers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional
import pandas as pd


class MarketDataProvider(ABC):
    """
    Abstract base class for market data providers.
    
    Providers fetch OHLCV data from various sources (yfinance, Alpaca, IB, etc.)
    and return data in a standardized MultiIndex DataFrame format.
    
    DataFrame format:
        - Index: DatetimeIndex (trading days)
        - Columns: MultiIndex with levels (field, ticker)
          where field ∈ {Open, High, Low, Close, Volume}
          
    Example:
        ```
                       Open              High              Low               Close             Volume
               AAPL    MSFT    TSLA   AAPL    MSFT    TSLA  ...
        2024-01-02  185.50  375.10  238.45  187.20  377.50  240.10  ...
        2024-01-03  186.00  376.00  239.00  188.50  378.00  241.50  ...
        ```
    """
    
    @abstractmethod
    def fetch_ohlcv(
        self,
        tickers: list[str],
        start_date: str,
        end_date: str,
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetch OHLCV data for multiple tickers.
        
        Args:
            tickers: List of ticker symbols (e.g., ["AAPL", "MSFT", "TSLA"])
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            interval: Bar interval (e.g., "1d", "1h", "1m")
            
        Returns:
            DataFrame with MultiIndex columns (field, ticker) and DatetimeIndex
            
        Raises:
            ValueError: If invalid tickers or date range
            ConnectionError: If data source is unavailable
            RateLimitError: If rate limit exceeded (provider-specific)
        """
        pass
    
    @abstractmethod
    def fetch_latest_price(self, ticker: str) -> float:
        """
        Get latest/current price for a single ticker.
        
        Args:
            ticker: Ticker symbol (e.g., "AAPL")
            
        Returns:
            Latest price as float
            
        Raises:
            ValueError: If invalid ticker
            ConnectionError: If data source is unavailable
        """
        pass
    
    @abstractmethod
    def get_ticker_info(self, ticker: str) -> dict:
        """
        Get ticker metadata (company name, sector, etc.).
        
        Args:
            ticker: Ticker symbol (e.g., "AAPL")
            
        Returns:
            Dictionary with metadata:
                - name: Company name
                - sector: Sector classification
                - industry: Industry classification
                - market_cap: Market capitalization (optional)
                
        Raises:
            ValueError: If invalid ticker
            ConnectionError: If data source is unavailable
        """
        pass
    
    @abstractmethod
    def is_market_open(self) -> bool:
        """
        Check if market is currently open for trading.
        
        Returns:
            True if market is open, False otherwise
            
        Note:
            For historical data providers (yfinance), may always return False.
            For live data providers (Alpaca, IB), returns actual market status.
        """
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """
        Get provider name for logging and debugging.
        
        Returns:
            Provider name (e.g., "yfinance", "alpaca", "ib")
        """
        pass
