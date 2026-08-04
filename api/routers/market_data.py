"""Market data endpoints."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from api.models.market_data import (
    VolumeAnalysisResponse,
    build_volume_analysis_response,
)
from api.models.screener import CandlePatternOut, PriceHistoryPoint
from api.utils.files import get_today_str
from swing_screener.analysis.volume_zones import VolumeZoneConfig, analyze_volume_zones
from swing_screener.data.price_history import price_history_map
from swing_screener.data.providers import get_market_data_provider
from swing_screener.indicators.candles import CandleConfig, detect_patterns
from swing_screener.utils.date_helpers import get_default_history_start

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market-data", tags=["market-data"])


class TickerCandlesResponse(BaseModel):
    ticker: str
    provider: str
    interval: str
    data_as_of: str | None
    fetched_at: str
    price_history: list[PriceHistoryPoint]
    patterns: list[CandlePatternOut]


@router.get("/{ticker}/candles", response_model=TickerCandlesResponse)
def get_ticker_candles(
    ticker: str,
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    interval: str = Query(default="1d"),
) -> TickerCandlesResponse:
    """Return OHLCV price history and detected candle patterns for a ticker.

    Used by the frontend chart when the ticker is not present in the most
    recent screener result (e.g. open positions, watchlist items).
    """
    symbol = ticker.strip().upper()
    provider = get_market_data_provider()
    provider_name = provider.get_provider_name()
    _start = start_date or get_default_history_start()
    _end = end_date or get_today_str()

    try:
        ohlcv = provider.fetch_ohlcv(
            [symbol], start_date=_start, end_date=_end, interval=interval
        )
    except Exception as exc:
        logger.warning("OHLCV fetch failed for %s: %s", symbol, exc)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "market_data_provider_failed",
                "message": "Market data provider failed.",
                "provider": provider_name,
            },
        )

    if ohlcv is None or ohlcv.empty:
        return TickerCandlesResponse(
            ticker=symbol,
            provider=provider_name,
            interval=interval,
            data_as_of=None,
            fetched_at=datetime.now(timezone.utc).isoformat(),
            price_history=[],
            patterns=[],
        )

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
            volume_ratio=p.volume_ratio,
            bar_pressure=p.bar_pressure,
            volume_confirmed=p.volume_confirmed,
        )
        for p in patterns_map.get(symbol, [])
    ]

    return TickerCandlesResponse(
        ticker=symbol,
        provider=provider_name,
        interval=interval,
        data_as_of=price_history[-1].date if price_history else None,
        fetched_at=datetime.now(timezone.utc).isoformat(),
        price_history=price_history,
        patterns=patterns,
    )


@router.get("/{ticker}/volume-analysis", response_model=VolumeAnalysisResponse)
def get_ticker_volume_analysis(
    ticker: str,
    interval: str = Query(default="1d"),
    lookback: int = Query(default=120, ge=1),
    min_rr: float = Query(default=2.0, ge=0.0),
) -> VolumeAnalysisResponse:
    """Advisory volume-zone analysis for a single symbol (read-only)."""
    symbol = ticker.strip().upper()
    provider = get_market_data_provider()
    provider_name = provider.get_provider_name()

    end_date = get_today_str()
    start_date = (
        pd.Timestamp(end_date) - pd.Timedelta(days=int(lookback) * 2 + 400)
    ).strftime("%Y-%m-%d")

    try:
        ohlcv = provider.fetch_ohlcv(
            [symbol], start_date=start_date, end_date=end_date, interval=interval
        )
    except Exception as exc:
        logger.warning("Volume-analysis OHLCV fetch failed for %s: %s", symbol, exc)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "market_data_provider_failed",
                "message": "Market data provider failed.",
                "provider": provider_name,
            },
        ) from exc

    if ohlcv is None or ohlcv.empty:
        ohlcv = pd.DataFrame()

    analysis = analyze_volume_zones(
        symbol,
        ohlcv,
        interval=interval,
        lookback=int(lookback),
        min_rr=float(min_rr),
        cfg=VolumeZoneConfig(),
    )
    return build_volume_analysis_response(analysis, provider_name, min_rr=float(min_rr))
