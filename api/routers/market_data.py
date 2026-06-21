"""Market data endpoints."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from pydantic import BaseModel

from api.models.screener import CandlePatternOut, PriceHistoryPoint
from api.utils.files import get_today_str
from swing_screener.data.price_history import price_history_map
from swing_screener.data.providers import get_default_provider
from swing_screener.indicators.candles import CandleConfig, detect_patterns
from swing_screener.utils.date_helpers import get_default_history_start

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market-data", tags=["market-data"])


class TickerCandlesResponse(BaseModel):
    ticker: str
    price_history: list[PriceHistoryPoint]
    patterns: list[CandlePatternOut]


@router.get("/{ticker}/candles", response_model=TickerCandlesResponse)
def get_ticker_candles(
    ticker: str,
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
) -> TickerCandlesResponse:
    """Return OHLCV price history and detected candle patterns for a ticker.

    Used by the frontend chart when the ticker is not present in the most
    recent screener result (e.g. open positions, watchlist items).
    """
    symbol = ticker.strip().upper()
    provider = get_default_provider()
    _start = start_date or get_default_history_start()
    _end = end_date or get_today_str()

    try:
        ohlcv = provider.fetch_ohlcv([symbol], start_date=_start, end_date=_end)
    except Exception as exc:
        logger.warning("OHLCV fetch failed for %s: %s", symbol, exc)
        return TickerCandlesResponse(ticker=symbol, price_history=[], patterns=[])

    if ohlcv is None or ohlcv.empty:
        return TickerCandlesResponse(ticker=symbol, price_history=[], patterns=[])

    raw_history = price_history_map(ohlcv, tickers=[symbol]).get(symbol, [])
    price_history = [PriceHistoryPoint(**point) for point in raw_history]

    patterns_map = detect_patterns(ohlcv, tickers=[symbol], cfg=CandleConfig())
    patterns = [
        CandlePatternOut(
            bar_index=p.bar_index,
            date=p.date,
            name=p.name,
            direction=p.direction,
            key_level=p.key_level,
            context=p.context,
        )
        for p in patterns_map.get(symbol, [])
    ]

    return TickerCandlesResponse(ticker=symbol, price_history=price_history, patterns=patterns)
