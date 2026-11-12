from fastapi.testclient import TestClient

from api.main import app
from tests.support.state import seed_portfolio


POSITION = {
    "ticker": "ENGI.PA",
    "status": "open",
    "entry_date": "2026-02-25",
    "entry_price": 26.92,
    "stop_price": 26.50,
    "shares": 3,
    "position_id": "POS-ENGI-1",
    "source_order_id": "ORD-ENGI-ENTRY",
    "initial_risk": 0.42,
    "max_favorable_price": 28.22,
    "exit_date": None,
    "exit_price": None,
    "current_price": 27.01,
    "notes": "",
    "exit_order_ids": ["ORD-ENGI-STOP"],
}


def test_close_position_persists_optional_fee(monkeypatch, tmp_path):
    seed_portfolio(monkeypatch, tmp_path, positions=[POSITION], asof="2026-03-03")

    client = TestClient(app)
    response = client.post(
        "/api/portfolio/positions/POS-ENGI-1/close",
        json={
            "exit_price": 26.92,
            "fee_eur": 4.90,
            "reason": "Stop loss executed on broker",
        },
        headers={"Idempotency-Key": "close-engi-1"},
    )

    assert response.status_code == 200
    assert response.json()["fee_eur"] == 4.90

    position_response = client.get("/api/portfolio/positions/POS-ENGI-1")
    assert position_response.status_code == 200
    position = position_response.json()
    assert position["status"] == "closed"
    assert position["exit_price"] == 26.92
    assert position["exit_fee_eur"] == 4.90
    assert "Stop loss executed on broker" in position["notes"]
