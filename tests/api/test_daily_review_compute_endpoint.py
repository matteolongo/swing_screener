from datetime import date

from fastapi.testclient import TestClient

from api.main import app
from api.models.daily_review import DailyReview, DailyReviewSummary
from api.routers.daily_review import get_daily_review_service


class StubDailyReviewService:
    def __init__(self) -> None:
        self.received = None

    def compute_daily_review_from_state(self, strategy, positions, orders, top_n=10, universe=None):
        self.received = {
            "strategy": strategy,
            "positions": positions,
            "orders": orders,
            "top_n": top_n,
            "universe": universe,
        }
        return DailyReview(
            new_candidates=[],
            positions_hold=[],
            positions_update_stop=[],
            positions_close=[],
            summary=DailyReviewSummary(
                total_positions=0,
                no_action=0,
                update_stop=0,
                close_positions=0,
                new_candidates=0,
                review_date=date.today(),
            ),
        )


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
                "orders": [],
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert body["summary"]["new_candidates"] == 0

        assert stub_service.received is not None
        assert stub_service.received["top_n"] == 7
        assert stub_service.received["universe"] == "usd_all"
        assert stub_service.received["strategy"]["id"] == active_strategy["id"]
        assert len(stub_service.received["positions"]) == 1
    finally:
        app.dependency_overrides.pop(get_daily_review_service, None)
