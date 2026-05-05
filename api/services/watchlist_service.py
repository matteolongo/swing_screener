"""Watchlist enrichment service."""
from __future__ import annotations

import logging
from dataclasses import replace
from typing import Optional

import pandas as pd

from api.models.screener import PriceHistoryPoint
from api.models.watchlist import WatchItem, WatchlistItemView
from api.repositories.strategy_repo import StrategyRepository
from api.repositories.watchlist_repo import WatchlistRepository
from api.utils.files import get_today_str
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.selection.entries import build_signal_board
from swing_screener.strategy.config import build_entry_config
from swing_screener.utils.dataframe_helpers import get_close_matrix
from swing_screener.utils.date_helpers import get_default_history_start

logger = logging.getLogger(__name__)

WATCHLIST_SPARKLINE_BARS = 5


def _to_iso(ts) -> Optional[str]:
    if ts is None or pd.isna(ts):
        return None
    if isinstance(ts, pd.Timestamp):
        ts = ts.to_pydatetime()
    if hasattr(ts, "isoformat"):
        return ts.isoformat()
    return str(ts)


def _last_close_map(ohlcv: pd.DataFrame) -> tuple[dict[str, float], dict[str, str]]:
    prices: dict[str, float] = {}
    bars: dict[str, str] = {}
    if ohlcv is None or ohlcv.empty:
        return prices, bars
    close = get_close_matrix(ohlcv)
    for ticker in close.columns:
        series = close[ticker].dropna()
        if series.empty:
            continue
        prices[str(ticker)] = float(series.iloc[-1])
        iso = _to_iso(series.index[-1])
        if iso:
            bars[str(ticker)] = iso
    return prices, bars


def _sparkline_history_map(ohlcv: pd.DataFrame, tickers: list[str]) -> dict[str, list[PriceHistoryPoint]]:
    out: dict[str, list[PriceHistoryPoint]] = {}
    if ohlcv is None or ohlcv.empty:
        return out
    close = get_close_matrix(ohlcv)
    for ticker in tickers:
        if ticker not in close.columns:
            out[ticker] = []
            continue
        series = close[ticker].dropna().tail(WATCHLIST_SPARKLINE_BARS)
        out[ticker] = [
            PriceHistoryPoint(date=str(idx.date().isoformat() if hasattr(idx, "date") else idx), close=float(value))
            for idx, value in series.items()
        ]
    return out


def _compute_distance_pct(current_price: Optional[float], trigger_price: Optional[float]) -> Optional[float]:
    if (
        current_price is None
        or trigger_price is None
        or not pd.notna(current_price)
        or not pd.notna(trigger_price)
        or float(trigger_price) <= 0
    ):
        return None
    return ((float(current_price) - float(trigger_price)) / float(trigger_price)) * 100.0


class WatchlistService:
    def __init__(
        self,
        repo: WatchlistRepository,
        strategy_repo: StrategyRepository,
        provider: Optional[MarketDataProvider] = None,
    ) -> None:
        self._repo = repo
        self._strategy_repo = strategy_repo
        self._provider = provider or get_default_provider()

    def list_items(self) -> list[WatchlistItemView]:
        items = self._repo.list_items()
        if not items:
            return []

        tickers = [item.ticker for item in items]
        enriched = {item.ticker: WatchlistItemView(**item.model_dump()) for item in items}

        try:
            strategy = self._strategy_repo.get_active_strategy()
            signals_cfg = build_entry_config(strategy)
            # The watchlist view should still compute trigger distance for names that do
            # not yet have a full long-history candidate profile.
            signals_cfg = replace(signals_cfg, min_history=min(int(signals_cfg.min_history), 60))
            ohlcv = self._provider.fetch_ohlcv(
                tickers,
                start_date=get_default_history_start(),
                end_date=get_today_str(),
            )
            if ohlcv is None or ohlcv.empty:
                return self._sorted_items(items, enriched)

            board = build_signal_board(ohlcv, tickers, cfg=signals_cfg)
            last_prices, last_bars = _last_close_map(ohlcv)
            sparkline_history = _sparkline_history_map(ohlcv, tickers)

            for ticker in tickers:
                row = board.loc[ticker] if ticker in board.index else None
                trigger_price = None
                signal = None
                if row is not None:
                    raw_trigger = row.get("breakout_level")
                    trigger_price = float(raw_trigger) if pd.notna(raw_trigger) else None
                    raw_signal = row.get("signal")
                    signal = str(raw_signal) if pd.notna(raw_signal) else None
                payload = enriched[ticker].model_dump()
                payload.update(
                    current_price=last_prices.get(ticker),
                    last_bar=last_bars.get(ticker),
                    signal=signal,
                    signal_trigger_price=trigger_price,
                    distance_to_trigger_pct=_compute_distance_pct(last_prices.get(ticker), trigger_price),
                    price_history=sparkline_history.get(ticker, []),
                )
                enriched[ticker] = WatchlistItemView(**payload)
        except Exception:
            logger.exception("Failed to enrich watchlist pipeline view")

        return self._sorted_items(items, enriched)

    @staticmethod
    def _sorted_items(items: list[WatchItem], enriched: dict[str, WatchlistItemView]) -> list[WatchlistItemView]:
        def sort_key(item: WatchlistItemView) -> tuple[bool, float, str]:
            distance = item.distance_to_trigger_pct
            return (distance is None, distance if distance is not None else float("inf"), item.ticker)

        return sorted((enriched[item.ticker] for item in items), key=sort_key)
