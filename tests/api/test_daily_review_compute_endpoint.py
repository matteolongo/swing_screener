from datetime import date
from unittest.mock import Mock

import pandas as pd
import pytest

from fastapi.testclient import TestClient

from api.main import app
from api.models.daily_review import (
    DailyReview,
    DailyReviewCandidate,
    DailyReviewPositionEvaluationError,
    DailyReviewSummary,
)
from api.routers.daily_review import get_daily_review_service
from api.services.daily_review_service import DailyReviewService
from api.services.watchlist_service import WatchlistService
from swing_screener.strategy.storage import _default_strategy_payload


class StubDailyReviewService:
    def __init__(self) -> None:
        self.received = None

    def compute_daily_review_from_state(
        self,
        strategy,
        positions,
        orders,
        top_n=10,
        universe=None,
        preset=None,
        taxonomy_filter=None,
        include_candidates=True,
        watchlist=None,
    ):
        self.received = {
            "strategy": strategy,
            "positions": positions,
            "orders": orders,
            "top_n": top_n,
            "universe": universe,
            "preset": preset,
            "taxonomy_filter": taxonomy_filter,
            "include_candidates": include_candidates,
            "watchlist": watchlist,
        }
        return DailyReview(
            new_candidates=[
                DailyReviewCandidate(
                    ticker="AAPL",
                    signal="UNKNOWN",
                    close=150.0,
                    entry=None,
                    stop=None,
                    shares=None,
                    r_reward=None,
                )
            ],
            positions_hold=[],
            positions_update_stop=[],
            positions_close=[],
            evaluation_errors=[
                DailyReviewPositionEvaluationError(
                    symbol="AAPL",
                    code="position_evaluation_failed",
                    message="Position evaluation could not be completed.",
                )
            ],
            summary=DailyReviewSummary(
                total_positions=0,
                no_action=0,
                update_stop=0,
                close_positions=0,
                new_candidates=1,
                evaluation_error_count=1,
                review_date=date.today(),
            ),
        )

    def save_snapshot(self, review, strategy_name):
        self.saved = (review, strategy_name)


def test_daily_review_compute_endpoint():
    stub_service = StubDailyReviewService()
    app.dependency_overrides[get_daily_review_service] = lambda: stub_service

    try:
        client = TestClient(app)
        active_strategy = client.get("/api/strategy/active").json()

        response = client.post(
            "/api/daily-review/compute",
            json={
                "top_n": 7,
                "include_candidates": False,
                "universe": "usd_all",
                "strategy": active_strategy,
                "positions": [
                    {
                        "ticker": "AAPL",
                        "status": "open",
                        "entry_date": "2026-02-20",
                        "entry_price": 100.0,
                        "stop_price": 95.0,
                        "shares": 10,
                        "position_id": "POS-AAPL-TEST",
                        "source_order_id": "AAPL-ENTRY-TEST",
                        "initial_risk": 5.0,
                        "max_favorable_price": 101.0,
                        "exit_date": None,
                        "exit_price": None,
                        "current_price": 100.5,
                        "notes": "",
                        "exit_order_ids": ["ORD-STOP-AAPL-TEST"],
                    }
                ],
                "orders": [
                    {
                        "order_id": "ORD-AAPL-ENTRY-TEST",
                        "ticker": "AAPL",
                        "status": "filled",
                        "order_type": "BUY_LIMIT",
                        "quantity": 10,
                        "limit_price": 100.0,
                        "stop_price": 95.0,
                        "order_date": "2026-02-20",
                        "filled_date": "2026-02-21",
                        "entry_price": 100.0,
                        "notes": "local snapshot order",
                        "order_kind": "entry",
                        "parent_order_id": None,
                        "position_id": "POS-AAPL-TEST",
                        "tif": "GTC",
                        "fee_eur": None,
                        "fill_fx_rate": None,
                    }
                ],
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert body["summary"]["new_candidates"] == 1
        assert {
            key: body["new_candidates"][0][key]
            for key in ("entry", "stop", "shares", "r_reward")
        } == {
            "entry": None,
            "stop": None,
            "shares": None,
            "r_reward": None,
        }
        assert body["summary"]["evaluation_error_count"] == 1
        assert body["evaluation_errors"] == [
            {
                "symbol": "AAPL",
                "code": "position_evaluation_failed",
                "message": "Position evaluation could not be completed.",
            }
        ]

        assert stub_service.received is not None
        assert stub_service.received["top_n"] == 7
        assert stub_service.received["include_candidates"] is False
        assert stub_service.received["universe"] == "usd_all"
        assert stub_service.received["strategy"]["id"] == active_strategy["id"]
        assert len(stub_service.received["positions"]) == 1
        assert stub_service.received["orders"][0]["order_id"] == "ORD-AAPL-ENTRY-TEST"
    finally:
        app.dependency_overrides.pop(get_daily_review_service, None)


@pytest.mark.parametrize(
    "tickers, expected", [(["NEAR", "FAR", "ABOVE"], ["NEAR"]), ([], [])]
)
def test_compute_enriches_only_client_watchlist_without_reading_server_state(
    tmp_path, tickers, expected
):
    class Provider:
        def fetch_ohlcv(self, symbols, start_date, end_date):
            prices = {"NEAR": 99.0, "FAR": 90.0, "ABOVE": 101.0}
            return pd.DataFrame(
                [[100.0] * len(symbols)] * 69
                + [[prices[symbol] for symbol in symbols]],
                index=pd.date_range("2026-06-01", periods=70),
                columns=pd.MultiIndex.from_product([["Close"], symbols]),
            )

    watchlist_repo = Mock()
    watchlist_repo.list_items.side_effect = AssertionError("must use local watchlist")
    strategy_repo = Mock()
    strategy_repo.get_active_strategy.side_effect = AssertionError(
        "must use local strategy"
    )
    screener = Mock()
    service = DailyReviewService(
        screener,
        Mock(),
        watchlist_service=WatchlistService(watchlist_repo, strategy_repo, Provider()),
        data_dir=tmp_path,
    )
    app.dependency_overrides[get_daily_review_service] = lambda: service
    try:
        response = TestClient(app).post(
            "/api/daily-review/compute",
            json={
                "strategy": _default_strategy_payload(),
                "positions": [],
                "orders": [],
                "include_candidates": False,
                "watchlist": [
                    {"ticker": ticker, "watched_at": "2026-09-11", "source": "manual"}
                    for ticker in tickers
                ],
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert [item["ticker"] for item in body["watchlist_near_trigger"]] == expected
        assert body["summary"]["watchlist_near_trigger"] == len(expected)
        if expected:
            assert body["watchlist_near_trigger"][0]["distance_to_trigger_pct"] == -1.0
        watchlist_repo.list_items.assert_not_called()
        strategy_repo.get_active_strategy.assert_not_called()
        screener.run_screener.assert_not_called()
        assert not (tmp_path / "daily_reviews").exists()
    finally:
        app.dependency_overrides.pop(get_daily_review_service, None)


def test_daily_review_snapshot_endpoint_is_the_explicit_write_command():
    stub_service = StubDailyReviewService()
    app.dependency_overrides[get_daily_review_service] = lambda: stub_service
    review = stub_service.compute_daily_review_from_state({}, [], [])

    try:
        response = TestClient(app).post(
            "/api/daily-review/snapshots",
            json={
                "review": review.model_dump(mode="json"),
                "strategy_name": "momentum",
            },
        )

        assert response.status_code == 201
        assert response.json() == {"saved": True}
        saved_review, strategy_name = stub_service.saved
        assert saved_review == review
        assert saved_review.new_candidates[0].entry is None
        assert saved_review.new_candidates[0].stop is None
        assert saved_review.new_candidates[0].shares is None
        assert saved_review.new_candidates[0].r_reward is None
        assert strategy_name == "momentum"
    finally:
        app.dependency_overrides.pop(get_daily_review_service, None)
