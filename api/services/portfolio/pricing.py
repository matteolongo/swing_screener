"""Market-data / live-price / FX / earnings concern."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

import pandas as pd

from api.models.portfolio import EarningsProximityResponse
from api.utils.files import get_today_str
from api.utils.converters import to_iso as _to_iso
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.utils.date_helpers import get_default_history_start

logger = logging.getLogger(__name__)

# Module-level caches
_eurusd_cache: dict[str, tuple[float, float]] = {}  # {"eurusd": (rate, timestamp)}
_CACHE_TTL_SECONDS = 300  # 5 minutes
_earnings_cache: dict[str, tuple[str, EarningsProximityResponse]] = {}


def _parse_earnings_date(raw) -> Optional[dt.date]:
    if raw is None or pd.isna(raw):
        return None
    if isinstance(raw, pd.Timestamp):
        raw = raw.to_pydatetime()
    if isinstance(raw, dt.datetime):
        return raw.date()
    if isinstance(raw, dt.date):
        return raw
    try:
        return dt.date.fromisoformat(str(raw)[:10])
    except (TypeError, ValueError):
        return None


def _last_close_map(ohlcv: pd.DataFrame) -> tuple[dict[str, float], dict[str, str]]:
    prices: dict[str, float] = {}
    bars: dict[str, str] = {}
    if ohlcv is None or ohlcv.empty:
        return prices, bars
    if "Close" not in ohlcv.columns.get_level_values(0):
        return prices, bars
    close = ohlcv["Close"]
    for t in close.columns:
        series = close[t].dropna()
        if series.empty:
            continue
        ts = series.index[-1]
        iso = _to_iso(ts)
        if iso:
            bars[str(t)] = iso
        prices[str(t)] = float(series.iloc[-1])
    return prices, bars


def _pct_to_target(target: Optional[float], last_price: Optional[float]) -> Optional[float]:
    if target is None or last_price is None or last_price == 0:
        return None
    return (target - last_price) / last_price * 100.0


class PositionPricingService:
    """Market-data, live-price, FX, and earnings proximity."""

    def __init__(self, provider: Optional[MarketDataProvider] = None) -> None:
        self._provider = provider or get_default_provider()

    def fetch_recent_ohlcv(self, ticker: str, *, lookback_days: int = 400) -> pd.DataFrame:
        """Fetch recent daily OHLCV for one ticker (enough bars for 200-SMA / 52w stats)."""
        end_date = get_today_str()
        start_date = (pd.Timestamp(end_date) - pd.Timedelta(days=lookback_days)).strftime("%Y-%m-%d")
        return self._provider.fetch_ohlcv([ticker], start_date=start_date, end_date=end_date)

    def _fetch_last_prices(self, tickers: list[str]) -> dict[str, float]:
        if not tickers:
            return {}

        start_date = get_default_history_start()
        end_date = get_today_str()
        ohlcv = self._provider.fetch_ohlcv(tickers, start_date=start_date, end_date=end_date)
        prices, _ = _last_close_map(ohlcv)
        return prices

    @staticmethod
    def _fallback_price(position: dict) -> float:
        exit_price = position.get("exit_price")
        if exit_price is not None:
            return float(exit_price)
        current_price = position.get("current_price")
        if current_price is not None:
            return float(current_price)
        return float(position.get("entry_price", 0.0))

    def _attach_live_prices(self, positions: list[dict]) -> dict[str, float]:
        """Attach latest price to open positions and return fetched price map."""
        last_prices: dict[str, float] = {}
        open_positions = [p for p in positions if p.get("status") == "open"]
        if open_positions:
            try:
                tickers = list({str(p.get("ticker", "")).upper() for p in open_positions if p.get("ticker")})
                last_prices = self._fetch_last_prices(tickers)
                for pos in positions:
                    if pos.get("status") == "open":
                        ticker = str(pos.get("ticker", "")).upper()
                        pos["current_price"] = last_prices.get(ticker)
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning("Failed to fetch current prices (data error): %s", exc)
                for pos in positions:
                    if pos.get("status") == "open":
                        pos["current_price"] = None
            except Exception:
                logger.exception("Unexpected error fetching current prices")
                for pos in positions:
                    if pos.get("status") == "open":
                        pos["current_price"] = None

        return last_prices

    def _eurusd_rate(self) -> float:
        """Fetch EURUSD rate with simple caching."""
        import time
        now = time.time()
        cached = _eurusd_cache.get("eurusd")
        if cached is not None:
            rate, timestamp = cached
            if now - timestamp < _CACHE_TTL_SECONDS:
                return rate

        try:
            fx = self._fetch_last_prices(["EURUSD=X"])
            rate = float(fx.get("EURUSD=X", 0.0))
            rate = rate if rate > 0 else 1.0
            _eurusd_cache["eurusd"] = (rate, now)
            return rate
        except Exception as exc:
            logger.warning("Failed to fetch EURUSD fx rate: %s", exc)
            return 1.0

    def get_earnings_proximity(self, ticker: str) -> EarningsProximityResponse:
        normalized_ticker = ticker.strip().upper()
        today = get_today_str()
        cached = _earnings_cache.get(normalized_ticker)
        if cached is not None:
            cached_date, cached_response = cached
            if cached_date == today:
                return cached_response

        try:
            import yfinance

            calendar = yfinance.Ticker(normalized_ticker).calendar or {}
            earnings_dates = calendar.get("Earnings Date", [])
            if not isinstance(earnings_dates, list):
                earnings_dates = [earnings_dates]

            today_dt = dt.date.fromisoformat(today)
            upcoming = sorted(
                parsed
                for raw_date in earnings_dates
                if (parsed := _parse_earnings_date(raw_date)) is not None and parsed >= today_dt
            )
            if not upcoming:
                result = EarningsProximityResponse(ticker=normalized_ticker)
            else:
                next_date = upcoming[0]
                days_until = (next_date - today_dt).days
                result = EarningsProximityResponse(
                    ticker=normalized_ticker,
                    next_earnings_date=next_date.isoformat(),
                    days_until=days_until,
                    warning=days_until <= 10,
                )
        except Exception as exc:
            logger.info("Failed to fetch earnings calendar for %s: %s", normalized_ticker, exc)
            result = EarningsProximityResponse(ticker=normalized_ticker)

        _earnings_cache[normalized_ticker] = (today, result)
        return result
