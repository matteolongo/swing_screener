"""Offline market-data provider fake with call recording."""

from __future__ import annotations

from collections.abc import Iterable
import pandas as pd

from swing_screener.data.source_health import DataSourceHealth


class FakeMarketDataProvider:
    """Small provider fake that preserves the production OHLCV contract."""

    def __init__(
        self,
        *,
        ohlcv: pd.DataFrame | None = None,
        latest_prices: dict[str, float] | None = None,
        provider_name: str = "test",
    ) -> None:
        self.ohlcv = ohlcv
        self.latest_prices = dict(latest_prices or {})
        self.provider_name = provider_name
        self.fetch_ohlcv_calls: list[dict[str, object]] = []
        self.fetch_latest_price_calls: list[str] = []

    def fetch_ohlcv(
        self,
        tickers: Iterable[str],
        start_date: str | None = None,
        end_date: str | None = None,
        **kwargs: object,
    ) -> pd.DataFrame:
        requested = list(tickers)
        self.fetch_ohlcv_calls.append(
            {
                "tickers": requested,
                "start_date": start_date,
                "end_date": end_date,
                **kwargs,
            }
        )
        if self.ohlcv is None:
            raise KeyError("fake provider has no OHLCV data")
        available = set(self.ohlcv.columns.get_level_values(1))
        missing = [ticker for ticker in requested if ticker not in available]
        if missing:
            raise KeyError(f"fake provider has no OHLCV data for {missing}")
        columns = [column for column in self.ohlcv.columns if column[1] in requested]
        return self.ohlcv.loc[:, columns].copy()

    def fetch_latest_price(self, ticker: str) -> float:
        self.fetch_latest_price_calls.append(ticker)
        if ticker in self.latest_prices:
            return float(self.latest_prices[ticker])
        if self.ohlcv is not None and ("Close", ticker) in self.ohlcv:
            return float(self.ohlcv[("Close", ticker)].iloc[-1])
        raise KeyError(f"fake provider has no latest price for {ticker}")

    def get_provider_name(self) -> str:
        return self.provider_name

    def get_source_health(self) -> DataSourceHealth:
        return DataSourceHealth(
            provider=self.provider_name,
            domain="market_data",
            status="ok",
            quality_score=1.0,
            delay_policy="test_fixture",
        )


__all__ = ["FakeMarketDataProvider"]
