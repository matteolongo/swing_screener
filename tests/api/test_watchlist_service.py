from unittest.mock import Mock

import pytest
import pandas as pd

from api.models.watchlist import WatchItemUpsertRequest
from api.repositories.watchlist_repo import WatchlistRepository
from api.services.watchlist_service import WatchlistService
from swing_screener.strategy.storage import _default_strategy_payload


class _FakeProvider:
    def fetch_ohlcv(self, tickers, start_date: str, end_date: str):  # noqa: ANN001
        index = pd.date_range("2026-02-20", periods=70, freq="D")
        columns = pd.MultiIndex.from_product([["Close"], tickers])
        data = [[95.0 + idx * 0.1, 49.0 + idx * 0.05] for idx in range(len(index))]
        data[-2] = [101.0, 52.0]
        data[-1] = [102.0, 52.5]
        return pd.DataFrame(data, index=index, columns=columns)


def test_watchlist_service_enriches_and_sorts_items(tmp_path):
    repo = WatchlistRepository(tmp_path / "watchlist.json")
    repo.upsert_item("AAPL", WatchItemUpsertRequest(watch_price=90.0, currency="USD", source="screener"))
    repo.upsert_item("MSFT", WatchItemUpsertRequest(watch_price=45.0, currency="USD", source="screener"))

    strategy_repo = Mock()
    strategy_repo.get_active_strategy.return_value = _default_strategy_payload()  # noqa: SLF001

    service = WatchlistService(repo=repo, strategy_repo=strategy_repo, provider=_FakeProvider())
    items = service.list_items()

    assert [item.ticker for item in items] == ["MSFT", "AAPL"]
    msft, aapl = items
    assert aapl.current_price == 102.0
    assert aapl.signal_trigger_price is not None
    assert aapl.signal_trigger_price < aapl.current_price
    assert aapl.distance_to_trigger_pct == pytest.approx(
        100.0 * (aapl.current_price - aapl.signal_trigger_price) / aapl.signal_trigger_price
    )
    assert len(aapl.price_history) == 5
    assert aapl.price_history[-1].close == 102.0
    assert msft.distance_to_trigger_pct <= aapl.distance_to_trigger_pct
