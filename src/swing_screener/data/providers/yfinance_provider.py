"""Yfinance market data provider - wraps existing market_data.py logic."""
from __future__ import annotations

from datetime import datetime, timedelta, date
from pathlib import Path
from typing import Iterable, Iterator, Optional
import hashlib
import json
import logging
import re
import uuid
import pandas as pd
import yfinance as yf

from .base import MarketDataProvider
from .stooq_provider import StooqDataProvider
from ..market_data import fetch_ticker_metadata
from swing_screener.data.source_health import (
    DataSourceHealth, SourceDescriptor, ProbeResult, record_fallback,
)
from swing_screener.data.providers._probe import ohlcv_canary_probe
from swing_screener.utils import normalize_tickers

logger = logging.getLogger(__name__)


class YfinanceProvider(MarketDataProvider):
    """
    Yahoo Finance market data provider.
    
    Self-contained provider with integrated caching logic.
    Fetches OHLCV data from Yahoo Finance and caches to parquet files.
    """
    
    _THREAD_SAFE_BATCH_SIZE = 20
    _RETRY_CHUNK_SIZE = 10

    def __init__(
        self,
        cache_dir: str = ".cache/market_data",
        auto_adjust: bool = True,
        progress: bool = False,
        stooq_fallback_enabled: bool = True,
        stooq_timeout_sec: float = 10.0,
        stooq_provider: StooqDataProvider | None = None,
        same_day_cache_ttl_minutes: float = 15.0,
    ):
        """
        Initialize Yfinance provider.

        Args:
            cache_dir: Directory for parquet cache files
            auto_adjust: Use adjusted prices (default: True)
            progress: Show download progress bar (default: False)
            same_day_cache_ttl_minutes: Max age of a cache file reused for
                requests whose end date is today or later (default: 15)
        """
        self.cache_dir = Path(cache_dir)
        self.auto_adjust = auto_adjust
        self.progress = progress
        self.same_day_cache_ttl_minutes = float(same_day_cache_ttl_minutes)
        self.stooq_fallback_enabled = bool(stooq_fallback_enabled)
        self._stooq_provider = stooq_provider or StooqDataProvider(timeout_sec=stooq_timeout_sec)
        
        # Create cache directory
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._configure_yf_tz_cache()
    
    def _slice_window(
        self,
        frame: Optional[pd.DataFrame],
        start_date: str,
        end_exclusive: str,
    ) -> Optional[pd.DataFrame]:
        """Trim a cached frame (which may cover a wider window) to the request."""
        if frame is None or frame.empty or not isinstance(frame.index, pd.DatetimeIndex):
            return frame
        start_ts = pd.Timestamp(start_date, tz=frame.index.tz)
        end_ts = pd.Timestamp(end_exclusive, tz=frame.index.tz)
        return frame.loc[(frame.index >= start_ts) & (frame.index < end_ts)]

    def _ticker_cache_dir(self) -> Path:
        return self.cache_dir / "by_ticker"

    def _ticker_cache_path(self, ticker: str) -> Path:
        """Per-ticker parquet path, so universe membership changes never
        invalidate other tickers' cached data."""
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", ticker)
        if safe != ticker:
            safe = f"{safe}__{hashlib.sha1(ticker.encode('utf-8')).hexdigest()[:8]}"
        return self._ticker_cache_dir() / f"{safe}__adj={int(self.auto_adjust)}.parquet"

    def _ticker_index_path(self) -> Path:
        return self._ticker_cache_dir() / "index.json"

    def _index_key(self, ticker: str) -> str:
        return f"{ticker}|adj={int(self.auto_adjust)}"

    def _load_ticker_index(self) -> dict:
        """Coverage index: ticker key -> {start, end} of the cached window."""
        try:
            payload = json.loads(self._ticker_index_path().read_text(encoding="utf-8"))
            return payload if isinstance(payload, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save_ticker_index(self, index: dict) -> None:
        path = self._ticker_index_path()
        tmp = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex}")
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
            tmp.replace(path)
        except OSError as exc:
            logger.warning("Failed to persist OHLCV cache index %s: %s", path, exc)
            try:
                tmp.unlink(missing_ok=True)
            except OSError as rm_exc:
                logger.debug("Failed to remove temp cache index %s: %s", tmp, rm_exc)

    def _store_per_ticker_cache(
        self,
        df: pd.DataFrame,
        tickers: list[str],
        start_date: str,
        end_for_coverage: str,
    ) -> None:
        """Persist each downloaded ticker's columns to its own parquet and
        extend the coverage window recorded in the index."""
        if df is None or df.empty or not isinstance(df.columns, pd.MultiIndex):
            return
        self._ticker_cache_dir().mkdir(parents=True, exist_ok=True)
        index = self._load_ticker_index()
        present = set(map(str, df.columns.get_level_values(1)))
        dirty = False
        for ticker in tickers:
            if ticker not in present:
                continue
            sub = df.loc[:, df.columns.get_level_values(1) == ticker]
            if sub.dropna(how="all").empty:
                continue
            path = self._ticker_cache_path(ticker)
            if path.exists():
                existing = self._read_cached_ohlcv(path, [ticker])
                if existing is not None and not existing.empty:
                    merged = pd.concat([existing, sub])
                    merged = merged.loc[~merged.index.duplicated(keep="last")].sort_index()
                    sub = merged
            self._write_cached_ohlcv(path, sub)
            key = self._index_key(ticker)
            entry = index.get(key) if isinstance(index.get(key), dict) else {}
            old_start = str(entry.get("start")) if entry.get("start") else None
            old_end = str(entry.get("end")) if entry.get("end") else None
            index[key] = {
                "start": min(start_date, old_start) if old_start else start_date,
                "end": max(end_for_coverage, old_end) if old_end else end_for_coverage,
            }
            dirty = True
        if dirty:
            self._save_ticker_index(index)

    def _configure_yf_tz_cache(self) -> None:
        """Point yfinance timezone cache to a writable project-local directory."""
        if not hasattr(yf, "set_tz_cache_location"):
            return

        tz_cache_dir = self.cache_dir / "yfinance_tz_cache"
        try:
            tz_cache_dir.mkdir(parents=True, exist_ok=True)
            yf.set_tz_cache_location(str(tz_cache_dir))
        except Exception as exc:  # pragma: no cover - defensive, depends on host FS perms
            logger.warning("Failed to configure yfinance tz cache at %s: %s", tz_cache_dir, exc)

    def get_source_health(self) -> DataSourceHealth:
        return DataSourceHealth(
            provider="yfinance",
            domain="market_data",
            status="ok",
            quality_score=0.65,
            delay_policy="delayed_or_eod",
            warnings=["unofficial_provider"],
        )

    def _read_cached_ohlcv(self, cache_file: Path, tickers: list[str]) -> pd.DataFrame | None:
        """
        Read cached OHLCV parquet defensively.

        If cache is corrupted/invalid, remove it so subsequent reads do not loop forever.
        """
        try:
            cached = pd.read_parquet(cache_file)
            return self._clean_ohlcv(cached, tickers)
        except Exception as exc:
            logger.warning("Invalid OHLCV cache detected at %s: %s", cache_file, exc)
            try:
                cache_file.unlink(missing_ok=True)
            except Exception as remove_exc:
                logger.warning("Failed to remove invalid OHLCV cache %s: %s", cache_file, remove_exc)
            return None

    def _write_cached_ohlcv(self, cache_file: Path, df: pd.DataFrame) -> None:
        """
        Persist OHLCV cache atomically to avoid partial/corrupted parquet files.
        """
        tmp_file = cache_file.with_name(f".{cache_file.name}.tmp-{uuid.uuid4().hex}")
        try:
            df.to_parquet(tmp_file)
            tmp_file.replace(cache_file)
        except Exception as exc:
            logger.warning("Failed writing OHLCV cache %s: %s", cache_file, exc)
            try:
                tmp_file.unlink(missing_ok=True)
            except Exception as rm_exc:
                logger.debug("Failed to remove temp OHLCV cache %s: %s", tmp_file, rm_exc)

    def _iter_chunks(self, tickers: list[str], size: int) -> Iterator[list[str]]:
        """Yield fixed-size chunks from a ticker list."""
        for i in range(0, len(tickers), size):
            yield tickers[i : i + size]

    def _supports_stooq_fallback(self, interval: str) -> bool:
        return self.stooq_fallback_enabled and str(interval).strip().lower() == "1d"

    def _stooq_end_date(self, end_date: Optional[str]) -> str:
        if not end_date:
            return date.today().isoformat()
        try:
            exclusive_end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return end_date
        return (exclusive_end - timedelta(days=1)).isoformat()

    def _fetch_stooq_fallback(
        self,
        tickers: list[str],
        start_date: str,
        end_date: Optional[str],
        *,
        interval: str,
    ) -> pd.DataFrame:
        if not tickers or not self._supports_stooq_fallback(interval):
            return pd.DataFrame()
        try:
            return self._stooq_provider.fetch_ohlcv(
                tickers,
                start_date=start_date,
                end_date=self._stooq_end_date(end_date),
                interval="1d",
            )
        except Exception as exc:
            logger.warning(
                "Stooq fallback failed for %s tickers (%s): %s",
                len(tickers),
                ",".join(tickers[:5]),
                exc,
            )
            record_fallback(
                domain="market_data",
                from_provider="yfinance",
                reason=f"stooq fallback failed: {exc}",
                fell_back_to="stooq",
                tickers=list(tickers[:20]),
            )
            return pd.DataFrame()

    def _download_raw(
        self,
        tickers: list[str],
        start_date: str,
        end_date: Optional[str],
        threads: Optional[bool] = None,
    ) -> pd.DataFrame:
        """
        Download raw data from yfinance.

        For larger batches, disable yfinance threading to avoid sporadic failures in
        multi-ticker requests.
        """
        use_threads = threads if threads is not None else len(tickers) <= self._THREAD_SAFE_BATCH_SIZE
        return yf.download(
            tickers,
            start=start_date,
            end=end_date,
            auto_adjust=self.auto_adjust,
            progress=self.progress,
            group_by="column",
            threads=use_threads,
        )

    def _download_batch(
        self,
        tickers: list[str],
        start_date: str,
        end_date: Optional[str],
        threads: Optional[bool] = None,
    ) -> pd.DataFrame:
        """Download and normalize one ticker batch, returning empty frame on failure."""
        try:
            df = self._download_raw(tickers, start_date, end_date, threads=threads)
        except Exception as exc:
            logger.warning(
                "yfinance download failed for %s tickers (%s): %s",
                len(tickers),
                ",".join(tickers[:5]),
                exc,
            )
            return pd.DataFrame()

        if df is None or df.empty:
            return pd.DataFrame()

        try:
            return self._standardize_columns(df, tickers)
        except ValueError as exc:
            logger.warning(
                "Failed to normalize yfinance columns for %s tickers (%s): %s",
                len(tickers),
                ",".join(tickers[:5]),
                exc,
            )
            return pd.DataFrame()

    def _merge_ohlcv_frames(self, base: pd.DataFrame, extra: pd.DataFrame) -> pd.DataFrame:
        """Merge two normalized OHLCV frames and deduplicate overlapping columns."""
        if base is None or base.empty:
            return extra
        if extra is None or extra.empty:
            return base
        merged = pd.concat([base, extra], axis=1)
        merged = merged.loc[:, ~merged.columns.duplicated()]
        return merged.sort_index(axis=1)

    def _missing_close_tickers(self, df: pd.DataFrame, tickers: list[str]) -> list[str]:
        """Return tickers with missing or all-NaN Close series."""
        if df is None or df.empty:
            return list(tickers)
        if "Close" not in df.columns.get_level_values(0):
            return list(tickers)

        close = df["Close"]
        missing: list[str] = []
        for ticker in tickers:
            if ticker not in close.columns:
                missing.append(ticker)
                continue
            if close[ticker].dropna().empty:
                missing.append(ticker)
        return missing

    def _download_sequential(
        self,
        tickers: list[str],
        start_date: str,
        end_date: Optional[str],
    ) -> pd.DataFrame:
        """Download tickers one-by-one as a fallback when bulk calls fail."""
        out = pd.DataFrame()
        for ticker in tickers:
            single = self._download_batch([ticker], start_date, end_date, threads=False)
            out = self._merge_ohlcv_frames(out, single)
        return out

    def _retry_missing_tickers(
        self,
        tickers: list[str],
        start_date: str,
        end_date: Optional[str],
    ) -> pd.DataFrame:
        """
        Retry missing tickers in smaller batches, then one-by-one for stubborn symbols.
        """
        out = pd.DataFrame()
        for chunk in self._iter_chunks(tickers, self._RETRY_CHUNK_SIZE):
            chunk_df = self._download_batch(chunk, start_date, end_date, threads=False)
            out = self._merge_ohlcv_frames(out, chunk_df)

            still_missing = self._missing_close_tickers(chunk_df, chunk)
            if still_missing:
                out = self._merge_ohlcv_frames(
                    out, self._download_sequential(still_missing, start_date, end_date)
                )
        return out
    
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
    
    def _cache_is_fresh(self, cache_file: Path, max_age_sec: Optional[float]) -> bool:
        """A cache file is fresh when no max age applies or its mtime is within it."""
        if max_age_sec is None:
            return True
        try:
            age = datetime.now().timestamp() - cache_file.stat().st_mtime
        except OSError:
            return False
        return age <= max_age_sec

    def _fetch_ohlcv_with_config(
        self,
        tickers: list[str],
        start_date: str,
        end_date: Optional[str],
        interval: str = "1d",
        use_cache: bool = True,
        force_refresh: bool = False,
        allow_cache_fallback_on_error: bool = True,
        cache_max_age_sec: Optional[float] = None,
    ) -> pd.DataFrame:
        """
        Internal method to fetch OHLCV with optional None end_date for backward compatibility.

        Caching is per ticker: each symbol satisfied by its cached coverage
        window is served from disk; only the misses are downloaded.
        """
        # Normalize tickers
        tks = normalize_tickers(tickers)

        # Determine actual end date for yfinance call
        actual_end = end_date if end_date else None
        end_for_coverage = end_date or (date.today() + timedelta(days=1)).isoformat()

        cached_frames: list[pd.DataFrame] = []
        stale_fallback: dict[str, Path] = {}
        misses: list[str] = []
        read_cache = use_cache and not force_refresh
        index = self._load_ticker_index() if (read_cache or allow_cache_fallback_on_error) else {}
        for ticker in tks:
            path = self._ticker_cache_path(ticker)
            entry = index.get(self._index_key(ticker))
            covered = (
                isinstance(entry, dict)
                and str(entry.get("start") or "9999") <= start_date
                and str(entry.get("end") or "0000") >= end_for_coverage
                and path.exists()
            )
            if not covered:
                misses.append(ticker)
                continue
            if not read_cache or not self._cache_is_fresh(path, cache_max_age_sec):
                # Covering but unusable directly (cache reads disabled, forced
                # refresh, or past TTL): keep as error fallback only.
                stale_fallback[ticker] = path
                misses.append(ticker)
                continue
            frame = self._slice_window(
                self._read_cached_ohlcv(path, [ticker]), start_date, end_for_coverage
            )
            if frame is None or frame.empty:
                misses.append(ticker)
                continue
            cached_frames.append(frame)

        df = pd.DataFrame()
        if misses:
            # Download from Yahoo Finance (bulk first, then targeted retries)
            df = self._download_batch(misses, start_date, actual_end)

            if (df is None or df.empty) and len(misses) > 1:
                logger.warning(
                    "Bulk yfinance download returned no data for %s tickers; retrying sequentially.",
                    len(misses),
                )
                record_fallback(
                    domain="market_data",
                    from_provider="yfinance",
                    reason="bulk download empty; retrying sequentially",
                    fell_back_to="yfinance-sequential",
                    tickers=list(misses[:20]),
                )
                df = self._download_sequential(misses, start_date, actual_end)

            if df is None or df.empty:
                df = self._fetch_stooq_fallback(misses, start_date, end_date, interval=interval)

            if df is None or df.empty:
                df = pd.DataFrame()
                if allow_cache_fallback_on_error:
                    for ticker, path in stale_fallback.items():
                        frame = self._slice_window(
                            self._read_cached_ohlcv(path, [ticker]), start_date, end_for_coverage
                        )
                        if frame is not None and not frame.empty:
                            cached_frames.append(frame)
                if cached_frames:
                    record_fallback(
                        domain="market_data",
                        from_provider="yfinance",
                        reason="serving stale cache after download failure",
                        fell_back_to="stale_cache",
                        tickers=list(misses[:20]),
                    )
                if not cached_frames:
                    raise RuntimeError("Download empty. Check tickers or connection.")
            else:
                missing_tickers = self._missing_close_tickers(df, misses)
                if missing_tickers and len(misses) > 1:
                    logger.warning(
                        "yfinance missing close data for %s/%s tickers; retrying missing symbols.",
                        len(missing_tickers),
                        len(misses),
                    )
                    retry_df = self._retry_missing_tickers(missing_tickers, start_date, actual_end)
                    df = self._merge_ohlcv_frames(df, retry_df)

                    remaining_missing = self._missing_close_tickers(df, misses)
                    if remaining_missing:
                        logger.warning(
                            "yfinance still missing close data for %s tickers after retries (%s).",
                            len(remaining_missing),
                            ",".join(remaining_missing[:10]),
                        )
                        record_fallback(
                            domain="market_data",
                            from_provider="yfinance",
                            reason="missing close after retries; trying stooq",
                            fell_back_to="stooq",
                            tickers=list(remaining_missing[:20]),
                        )
                        fallback_df = self._fetch_stooq_fallback(
                            remaining_missing,
                            start_date,
                            end_date,
                            interval=interval,
                        )
                        df = self._merge_ohlcv_frames(df, fallback_df)

                # Tickers that still have no data but hold stale cached coverage
                # are better served stale than dropped.
                _pre_stale_len = len(cached_frames)
                if allow_cache_fallback_on_error and stale_fallback:
                    for ticker in self._missing_close_tickers(df, misses):
                        path = stale_fallback.get(ticker)
                        if path is None:
                            continue
                        frame = self._slice_window(
                            self._read_cached_ohlcv(path, [ticker]), start_date, end_for_coverage
                        )
                        if frame is not None and not frame.empty:
                            cached_frames.append(frame)
                if len(cached_frames) > _pre_stale_len:
                    record_fallback(
                        domain="market_data",
                        from_provider="yfinance",
                        reason="serving stale cache after download failure",
                        fell_back_to="stale_cache",
                        tickers=list(misses[:20]),
                    )

                if use_cache:
                    self._store_per_ticker_cache(df, misses, start_date, end_for_coverage)

        out = df
        for frame in cached_frames:
            out = self._merge_ohlcv_frames(out, frame)
        if out is None or out.empty:
            raise RuntimeError("Download empty. Check tickers or connection.")

        return self._clean_ohlcv(out, tks)
    
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
        # Historical windows never change, so their cache never expires. For
        # "today/live-edge" requests, reuse the cache only within a short TTL
        # so repeated runs are fast but post-close bars still show up.
        cache_max_age_sec: Optional[float] = None
        if request_end >= today:
            cache_max_age_sec = self.same_day_cache_ttl_minutes * 60.0

        # Delegate to internal method
        return self._fetch_ohlcv_with_config(
            tickers,
            start_date,
            end_date_adjusted,
            interval,
            use_cache,
            force_refresh,
            allow_cache_fallback_on_error,
            cache_max_age_sec=cache_max_age_sec,
        )
    
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

    @classmethod
    def describe(cls) -> SourceDescriptor:
        return SourceDescriptor(
            id="yfinance",
            display_name="Yahoo Finance",
            domain="market_data",
            role="primary",
            requires=None,
            configured=True,
            probeable=True,
            canary_market="us",
        )

    @classmethod
    def probe(cls, canary: str) -> ProbeResult:
        return ohlcv_canary_probe(cls(), canary, "yfinance")
