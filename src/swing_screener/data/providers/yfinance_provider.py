"""Yfinance market data provider - wraps existing market_data.py logic."""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, Optional
import hashlib
import pandas as pd
import yfinance as yf

from .base import MarketDataProvider
from ..market_data import fetch_ticker_metadata


class YfinanceProvider(MarketDataProvider):
    """
    Yahoo Finance market data provider.
    
    Self-contained provider with integrated caching logic.
    Fetches OHLCV data from Yahoo Finance and caches to parquet files.
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
        self.cache_dir = Path(cache_dir)
        self.auto_adjust = auto_adjust
        self.progress = progress
        
        # Create cache directory
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def _normalize_tickers(self, tickers: Iterable[str]) -> list[str]:
        """Normalize and deduplicate ticker list."""
        out = []
        for t in tickers:
            t = t.strip().upper()
            if t and t not in out:
                out.append(t)
        if not out:
            raise ValueError("tickers is empty.")
        return out
    
    def _cache_path(
        self,
        tickers: list[str],
        start: str,
        end: Optional[str],
        auto_adjust: bool,
    ) -> Path:
        """Generate cache file path for given parameters."""
        safe_end = end if end else "NONE"
        key = f"{'-'.join(tickers)}__{start}__{safe_end}__adj={int(auto_adjust)}"
        key = key.replace("/", "_")
        if len(key) > 200:
            digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
            prefix = "-".join(tickers[:3])
            key = f"{prefix}__n={len(tickers)}__{start}__{safe_end}__adj={int(auto_adjust)}__{digest}"
        return self.cache_dir / f"{key}.parquet"
    
    def _standardize_columns(self, df: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
        """Standardize column format to (field, ticker) MultiIndex."""
        if not isinstance(df.columns, pd.MultiIndex):
            t = tickers[0]
            df.columns = pd.MultiIndex.from_product([df.columns, [t]])
            return df

        fields = {"Open", "High", "Low", "Close", "Adj Close", "Volume"}

        lvl0 = set(map(str, df.columns.get_level_values(0).unique()))
        lvl1 = set(map(str, df.columns.get_level_values(1).unique()))

        if lvl0.issubset(fields):
            # (field, ticker)
            return df

        if lvl1.issubset(fields):
            # (ticker, field) -> swap to (field, ticker)
            df.columns = df.columns.swaplevel(0, 1)
            return df.sort_index(axis=1)

        # fallback: try to infer by checking intersection sizes
        if len(lvl0 & fields) > len(lvl1 & fields):
            return df
        if len(lvl1 & fields) > len(lvl0 & fields):
            df.columns = df.columns.swaplevel(0, 1)
            return df.sort_index(axis=1)

        raise ValueError(
            "Unable to infer MultiIndex level order (field, ticker) vs (ticker, field)."
        )
    
    def _clean_ohlcv(self, df: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
        """
        Clean and standardize OHLCV data.
        
        - Keeps only Open/High/Low/Close/Volume
        - Removes rows that are completely NaN
        - Sorts index by date
        - Ensures each ticker has all required columns (fills missing with NaN)
        """
        df = df.copy()
        df = df.sort_index()
        df = df.loc[~df.index.duplicated(keep="last")]

        # Keep only standard OHLCV fields
        keep_fields = ["Open", "High", "Low", "Close", "Volume"]
        existing_fields = [f for f in keep_fields if f in df.columns.get_level_values(0)]
        df = df.loc[:, df.columns.get_level_values(0).isin(existing_fields)]

        # Ensure all ticker columns are present
        cols = []
        for f in existing_fields:
            for t in tickers:
                cols.append((f, t))
        df = df.reindex(columns=pd.MultiIndex.from_tuples(cols))

        # Drop rows that are completely NaN
        df = df.dropna(how="all")
        return df
    
    def _fetch_ohlcv_with_config(
        self,
        tickers: list[str],
        start_date: str,
        end_date: Optional[str],
        use_cache: bool = True,
        force_refresh: bool = False,
        allow_cache_fallback_on_error: bool = True,
    ) -> pd.DataFrame:
        """
        Internal method to fetch OHLCV with optional None end_date for backward compatibility.
        
        This method preserves the cache path behavior when end_date is None.
        """
        # Normalize tickers
        tks = self._normalize_tickers(tickers)
        
        # Determine actual end date for yfinance call
        actual_end = end_date if end_date else None
        
        # Check cache - use original end_date (possibly None) for cache path
        cache_file = self._cache_path(tks, start_date, end_date, self.auto_adjust)
        
        if use_cache and (not force_refresh) and cache_file.exists():
            df = pd.read_parquet(cache_file)
            return self._clean_ohlcv(df, tks)
        
        # Download from Yahoo Finance
        try:
            df = yf.download(
                tks,
                start=start_date,
                end=actual_end,  # yfinance handles None as "today"
                auto_adjust=self.auto_adjust,
                progress=self.progress,
                group_by="column",
                threads=True,
            )
        except Exception as e:
            if allow_cache_fallback_on_error and cache_file.exists():
                df = pd.read_parquet(cache_file)
                return self._clean_ohlcv(df, tks)
            raise RuntimeError(f"Download failed: {e}") from e
        
        if df is None or df.empty:
            if allow_cache_fallback_on_error and cache_file.exists():
                df = pd.read_parquet(cache_file)
                return self._clean_ohlcv(df, tks)
            raise RuntimeError("Download empty. Check tickers or connection.")
        
        # Standardize column format
        df = self._standardize_columns(df, tks)
        
        # Cache result
        if use_cache:
            df.to_parquet(cache_file)
        
        return self._clean_ohlcv(df, tks)
    
    def fetch_ohlcv(
        self,
        tickers: list[str],
        start_date: str,
        end_date: str,
        interval: str = "1d",
        use_cache: bool = True,
        force_refresh: bool = False,
        allow_cache_fallback_on_error: bool = True,
    ) -> pd.DataFrame:
        """
        Fetch OHLCV data from Yahoo Finance.
        
        Args:
            tickers: List of ticker symbols
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format (inclusive)
            interval: Bar interval (default: "1d", yfinance supports 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
            use_cache: Enable caching (default: True)
            force_refresh: Force refresh even if cache exists (default: False)
            allow_cache_fallback_on_error: Use cached data if download fails (default: True)
            
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
        
        # Delegate to internal method
        return self._fetch_ohlcv_with_config(
            tickers,
            start_date,
            end_date_adjusted,
            use_cache,
            force_refresh,
            allow_cache_fallback_on_error,
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
