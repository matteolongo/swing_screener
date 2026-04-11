import json

from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app


def _seed_position_files(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    positions_path = data_dir / "positions.json"

    positions_path.write_text(
        json.dumps(
            {
                "asof": "2026-03-03",
                "positions": [
                    {
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
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return positions_path


def test_close_position_persists_optional_fee(monkeypatch, tmp_path):
    positions_path = _seed_position_files(tmp_path)
    monkeypatch.setattr(deps, "POSITIONS_FILE", positions_path)

    client = TestClient(app)
    response = client.post(
        "/api/portfolio/positions/POS-ENGI-1/close",
        json={
            "exit_price": 26.92,
            "fee_eur": 4.90,
            "reason": "Stop loss executed on broker",
        },
    )

    assert response.status_code == 200
    assert response.json()["fee_eur"] == 4.90

    positions = json.loads(positions_path.read_text(encoding="utf-8"))["positions"]
    assert len(positions) == 1
    position = positions[0]
    assert position["status"] == "closed"
    assert position["exit_price"] == 26.92
    assert position["exit_fee_eur"] == 4.90
    assert "Stop loss executed on broker" in position["notes"]
