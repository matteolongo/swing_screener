"""Stooq market data provider for daily OHLCV fallback."""
from __future__ import annotations

from datetime import date, datetime, timedelta
import io
import json
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

from .base import MarketDataProvider
from swing_screener.utils import normalize_tickers

_INSTRUMENT_MASTER_PATH = Path("data/intelligence/instrument_master.json")
_STOOQ_MARKET_SUFFIX = {
    ".PA": "fr",
    ".AS": "nl",
    ".MI": "it",
    ".DE": "de",
    ".L": "uk",
    ".SW": "ch",
    ".ST": "se",
    ".MC": "es",
    ".HE": "fi",
    ".BR": "be",
}
_COUNTRY_BY_MARKET = {
    "us": "US",
    "fr": "FR",
    "nl": "NL",
    "it": "IT",
    "de": "DE",
    "uk": "GB",
    "ch": "CH",
    "se": "SE",
    "es": "ES",
    "fi": "FI",
    "be": "BE",
}
_CURRENCY_BY_MARKET = {
    "us": "USD",
    "fr": "EUR",
    "nl": "EUR",
    "it": "EUR",
    "de": "EUR",
    "uk": "GBP",
    "ch": "CHF",
    "se": "SEK",
    "es": "EUR",
    "fi": "EUR",
    "be": "EUR",
}
_EXCHANGE_BY_MARKET = {
    "us": "US",
    "fr": "XPAR",
    "nl": "XAMS",
    "it": "XMIL",
    "de": "XETR",
    "uk": "XLON",
    "ch": "XSWX",
    "se": "XSTO",
    "es": "XMAD",
    "fi": "XHEL",
    "be": "XBRU",
}


def _safe_read_json(path: Path) -> Any:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


class StooqDataProvider(MarketDataProvider):
    """Daily-only OHLCV provider backed by Stooq CSV downloads."""

    def __init__(
        self,
        *,
        timeout_sec: float = 10.0,
        instrument_master_path: Path = _INSTRUMENT_MASTER_PATH,
    ) -> None:
        self._timeout_sec = float(timeout_sec)
        self._instrument_master_path = instrument_master_path
        self._stooq_symbol_map: dict[str, str] | None = None

    def _client(self) -> httpx.Client:
        return httpx.Client(
            timeout=self._timeout_sec,
            headers={"User-Agent": "swing-screener/1.0 (stooq fallback)"},
        )

    def _load_stooq_symbol_map(self) -> dict[str, str]:
        if self._stooq_symbol_map is not None:
            return self._stooq_symbol_map

        out: dict[str, str] = {}
        raw_master = _safe_read_json(self._instrument_master_path)
        records = raw_master if isinstance(raw_master, list) else []
        for record in records:
            if not isinstance(record, dict):
                continue
            symbol = str(record.get("symbol", "")).strip().upper()
            if not symbol:
                continue
            provider_map = record.get("provider_symbol_map")
            stooq_symbol = ""
            if isinstance(provider_map, dict):
                stooq_symbol = str(provider_map.get("stooq", "")).strip().lower()
            if not stooq_symbol:
                continue
            out[symbol] = stooq_symbol
            aliases = record.get("aliases")
            if isinstance(aliases, list):
                for alias in aliases:
                    alias_text = str(alias).strip().upper()
                    if alias_text and alias_text not in out:
                        out[alias_text] = stooq_symbol
        self._stooq_symbol_map = out
        return out

    def _market_from_symbol(self, ticker: str) -> str:
        normalized = str(ticker).strip().upper()
        for suffix, market in _STOOQ_MARKET_SUFFIX.items():
            if normalized.endswith(suffix):
                return market
        return "us"

    def _stooq_symbol_for(self, ticker: str) -> str:
        normalized = str(ticker).strip().upper()
        mapped = self._load_stooq_symbol_map().get(normalized)
        if mapped:
            return mapped

        for suffix, market in _STOOQ_MARKET_SUFFIX.items():
            if normalized.endswith(suffix):
                base = normalized[: -len(suffix)].strip(".").lower()
                return f"{base}.{market}" if base else normalized.lower()
        return f"{normalized.lower()}.us"

    def fetch_ohlcv(
        self,
        tickers: list[str],
        start_date: str,
        end_date: str,
        interval: str = "1d",
    ) -> pd.DataFrame:
        if str(interval).strip().lower() != "1d":
            raise ValueError("StooqDataProvider only supports daily OHLCV (interval='1d').")

        normalized_tickers = normalize_tickers(tickers)
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

        data_by_column: dict[tuple[str, str], pd.Series] = {}
        index_union: pd.DatetimeIndex | None = None

        with self._client() as client:
            for ticker in normalized_tickers:
                query_symbol = self._stooq_symbol_for(ticker)
                response = client.get(
                    "https://stooq.com/q/d/l/",
                    params={"s": query_symbol, "i": "d"},
                )
                response.raise_for_status()
                frame = pd.read_csv(io.StringIO(response.text), parse_dates=["Date"])
                if frame.empty or "Date" not in frame.columns:
                    continue
                frame = frame.rename(columns={column: str(column).strip() for column in frame.columns})
                frame = frame.set_index("Date").sort_index()
                frame = frame[
                    (frame.index >= pd.Timestamp(start_dt)) & (frame.index <= pd.Timestamp(end_dt))
                ]
                if frame.empty:
                    continue

                for src, dst in (
                    ("Open", "Open"),
                    ("High", "High"),
                    ("Low", "Low"),
                    ("Close", "Close"),
                    ("Volume", "Volume"),
                ):
                    if src in frame.columns:
                        data_by_column[(dst, ticker)] = frame[src].astype(float)
                index_union = frame.index if index_union is None else index_union.union(frame.index)

        if not data_by_column:
            return pd.DataFrame()

        assert index_union is not None
        out = pd.DataFrame(index=index_union.sort_values())
        for column_key, series in data_by_column.items():
            out[column_key] = series.reindex(out.index)
        out.columns = pd.MultiIndex.from_tuples(list(data_by_column.keys()))
        return out.sort_index()

    def fetch_latest_price(self, ticker: str) -> float:
        end_date = date.today()
        start_date = end_date - timedelta(days=14)
        frame = self.fetch_ohlcv(
            [ticker],
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            interval="1d",
        )
        if frame.empty or ("Close", str(ticker).strip().upper()) not in frame.columns:
            raise ConnectionError(f"No Stooq price data available for {ticker}")
        series = frame[("Close", str(ticker).strip().upper())].dropna()
        if series.empty:
            raise ConnectionError(f"No Stooq close data available for {ticker}")
        return float(series.iloc[-1])

    def get_ticker_info(self, ticker: str) -> dict:
        market = self._market_from_symbol(ticker)
        return {
            "name": None,
            "sector": None,
            "industry": None,
            "market_cap": None,
            "currency": _CURRENCY_BY_MARKET.get(market),
            "exchange": _EXCHANGE_BY_MARKET.get(market),
            "country_code": _COUNTRY_BY_MARKET.get(market),
            "provider_symbol": self._stooq_symbol_for(ticker),
        }

    def is_market_open(self) -> bool:
        return False

    def get_provider_name(self) -> str:
        return "stooq"
