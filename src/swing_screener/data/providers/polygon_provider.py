"""Polygon.io market data provider (EOD OHLCV via REST API)."""
from __future__ import annotations

import os
import time
from datetime import date
from pathlib import Path

import httpx
import pandas as pd

from .base import MarketDataProvider
from swing_screener.data.source_health import (
    DataSourceHealth,
    ProbeResult,
    SourceDescriptor,
)
from swing_screener.data.providers._probe import ohlcv_canary_probe

_BASE_URL = "https://api.polygon.io"
_SOURCE_ID = "polygon"


class PolygonProvider(MarketDataProvider):
    """
    Polygon.io EOD market data provider.

    Free tier: 5 requests/minute. `rate_limit_sleep` controls the inter-call
    delay (default 12 s; set to 0 in tests).
    """

    def __init__(
        self,
        api_key: str,
        cache_dir: str = ".cache/polygon_data",
        rate_limit_sleep: float = 12.0,
        cache_ttl_days: float | None = None,
    ) -> None:
        self.api_key = api_key
        self.cache_dir = Path(cache_dir)
        self.rate_limit_sleep = rate_limit_sleep
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        if cache_ttl_days is not None:
            self._cache_ttl_days = float(cache_ttl_days)
        else:
            try:
                from swing_screener.settings import get_settings_manager
                _doc = get_settings_manager().load_user_document()
                self._cache_ttl_days = float(_doc.get("cache", {}).get("polygon_cache_ttl_days", 7))
            except Exception:
                self._cache_ttl_days = 7.0

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _cache_path(self, ticker: str, start_date: str, end_date: str) -> Path:
        safe = ticker.replace("/", "_")
        return self.cache_dir / f"{safe}__{start_date}__{end_date}.parquet"

    def _fetch_bars_from_api(
        self, ticker: str, start_date: str, end_date: str
    ) -> list[dict]:
        url = (
            f"{_BASE_URL}/v2/aggs/ticker/{ticker}/range/1/day"
            f"/{start_date}/{end_date}"
        )
        resp = httpx.get(
            url,
            params={"adjusted": "true", "apiKey": self.api_key, "limit": 50000},
            timeout=30.0,
        )
        resp.raise_for_status()
        payload = resp.json()
        return payload.get("results") or []

    def _bars_to_series(
        self, bars: list[dict], ticker: str
    ) -> pd.DataFrame:
        if not bars:
            cols = pd.MultiIndex.from_tuples(
                [(f, ticker) for f in ("Open", "High", "Low", "Close", "Volume")]
            )
            return pd.DataFrame(columns=cols)

        ts = pd.to_datetime([b["t"] for b in bars], unit="ms", utc=True).tz_convert(None)
        data = {
            ("Open", ticker): [b["o"] for b in bars],
            ("High", ticker): [b["h"] for b in bars],
            ("Low", ticker): [b["l"] for b in bars],
            ("Close", ticker): [b["c"] for b in bars],
            ("Volume", ticker): [b["v"] for b in bars],
        }
        df = pd.DataFrame(data, index=ts)
        df.columns = pd.MultiIndex.from_tuples(df.columns)
        df.index.name = None
        return df

    def _fetch_ticker(
        self, ticker: str, start_date: str, end_date: str
    ) -> pd.DataFrame:
        cache = self._cache_path(ticker, start_date, end_date)
        if cache.exists():
            is_historical = end_date < date.today().isoformat()
            cache_age_s = time.time() - cache.stat().st_mtime
            if is_historical or cache_age_s <= self._cache_ttl_days * 86400:
                try:
                    return pd.read_parquet(cache)
                except Exception:
                    cache.unlink(missing_ok=True)
            else:
                cache.unlink(missing_ok=True)

        bars = self._fetch_bars_from_api(ticker, start_date, end_date)
        df = self._bars_to_series(bars, ticker)
        if not df.empty:
            df.to_parquet(cache)
        return df

    # ------------------------------------------------------------------
    # MarketDataProvider interface
    # ------------------------------------------------------------------

    def fetch_ohlcv(
        self,
        tickers: list[str],
        start_date: str,
        end_date: str,
        interval: str = "1d",
        use_cache: bool = True,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        frames: list[pd.DataFrame] = []
        for i, ticker in enumerate(tickers):
            if i > 0 and self.rate_limit_sleep > 0:
                time.sleep(self.rate_limit_sleep)

            cache = self._cache_path(ticker, start_date, end_date)
            if force_refresh and cache.exists():
                cache.unlink(missing_ok=True)
            if not use_cache and cache.exists():
                cache.unlink(missing_ok=True)

            frames.append(self._fetch_ticker(ticker, start_date, end_date))

        if not frames:
            return pd.DataFrame()

        result = pd.concat(frames, axis=1)
        result = result.sort_index()
        return result

    def fetch_latest_price(self, ticker: str) -> float:
        url = f"{_BASE_URL}/v2/last/trade/{ticker}"
        resp = httpx.get(url, params={"apiKey": self.api_key}, timeout=10.0)
        resp.raise_for_status()
        return float(resp.json()["results"]["p"])

    def get_ticker_info(self, ticker: str) -> dict:
        url = f"{_BASE_URL}/v3/reference/tickers/{ticker}"
        resp = httpx.get(url, params={"apiKey": self.api_key}, timeout=10.0)
        resp.raise_for_status()
        r = resp.json().get("results", {})
        return {
            "name": r.get("name"),
            "sector": r.get("sic_description"),
            "industry": r.get("sic_description"),
            "market_cap": r.get("market_cap"),
        }

    def is_market_open(self) -> bool:
        return False

    def get_provider_name(self) -> str:
        return _SOURCE_ID

    def get_source_health(self) -> DataSourceHealth:
        return DataSourceHealth(
            provider=_SOURCE_ID,
            domain="market_data",
            status="ok",
            quality_score=0.9,
            delay_policy="end_of_day",
        )

    # ------------------------------------------------------------------
    # DiagnosableSource
    # ------------------------------------------------------------------

    @classmethod
    def describe(cls) -> SourceDescriptor:
        configured = bool(os.getenv("POLYGON_IO_API_KEY"))
        return SourceDescriptor(
            id=_SOURCE_ID,
            display_name="Polygon.io",
            domain="market_data",
            role="primary",
            requires="POLYGON_IO_API_KEY",
            configured=configured,
            probeable=configured,
            canary_market="us",
        )

    @classmethod
    def probe(cls, canary: str) -> ProbeResult:
        api_key = os.getenv("POLYGON_IO_API_KEY")
        if not api_key:
            return ProbeResult(id=_SOURCE_ID, status="not_configured")
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            provider = cls(api_key=api_key, cache_dir=tmp, rate_limit_sleep=0.0)
            return ohlcv_canary_probe(provider, canary, _SOURCE_ID)
