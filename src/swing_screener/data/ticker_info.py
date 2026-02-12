"""Fetch ticker metadata (company name, sector, currency) using yfinance."""
from __future__ import annotations

import yfinance as yf
from typing import Optional
import logging

from swing_screener.data.currency import detect_currency

logger = logging.getLogger(__name__)


def get_ticker_info(ticker: str) -> dict[str, Optional[str]]:
    """
    Fetch company name, sector, and currency for a ticker.
    
    Returns:
        dict with keys: 'name', 'sector', 'currency'
        Returns None values if data unavailable.
    """
    try:
        t = yf.Ticker(ticker)
        info = t.info
        currency = info.get("currency")
        normalized_currency = str(currency).upper() if currency else None
        if normalized_currency not in {"USD", "EUR"}:
            normalized_currency = detect_currency(ticker)
        
        return {
            'name': info.get('longName') or info.get('shortName'),
            'sector': info.get('sector'),
            'currency': normalized_currency,
        }
    except Exception as e:
        logger.warning(f"Failed to fetch info for {ticker}: {e}")
        return {'name': None, 'sector': None, 'currency': detect_currency(ticker)}


def get_multiple_ticker_info(tickers: list[str]) -> dict[str, dict[str, Optional[str]]]:
    """
    Fetch company info for multiple tickers.
    
    Returns:
        dict mapping ticker -> {'name': str, 'sector': str, 'currency': str}
    """
    result = {}
    for ticker in tickers:
        result[ticker] = get_ticker_info(ticker)
    return result
