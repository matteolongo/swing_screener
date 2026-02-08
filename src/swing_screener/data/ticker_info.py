"""Fetch ticker metadata (company name, sector) using yfinance."""
from __future__ import annotations

import yfinance as yf
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def get_ticker_info(ticker: str) -> dict[str, Optional[str]]:
    """
    Fetch company name and sector for a ticker.
    
    Returns:
        dict with keys: 'name', 'sector'
        Returns None values if data unavailable.
    """
    try:
        t = yf.Ticker(ticker)
        info = t.info
        
        return {
            'name': info.get('longName') or info.get('shortName'),
            'sector': info.get('sector'),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch info for {ticker}: {e}")
        return {'name': None, 'sector': None}


def get_multiple_ticker_info(tickers: list[str]) -> dict[str, dict[str, Optional[str]]]:
    """
    Fetch company info for multiple tickers.
    
    Returns:
        dict mapping ticker -> {'name': str, 'sector': str}
    """
    result = {}
    for ticker in tickers:
        result[ticker] = get_ticker_info(ticker)
    return result
