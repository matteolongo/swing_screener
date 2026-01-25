from __future__ import annotations

import pandas as pd
from fastapi.testclient import TestClient

from swing_screener.api.app import create_app


def test_screening_run_uses_service(monkeypatch) -> None:
    def _fake_run_screening_preview(**kwargs):
        df = pd.DataFrame(
            [
                {"ticker": "AAA", "score": 1.0},
                {"ticker": "BBB", "score": 0.5},
            ]
        ).set_index("ticker")
        return df, df.to_csv()

    monkeypatch.setattr(
        "swing_screener.api.app.run_screening_preview",
        _fake_run_screening_preview,
    )

    client = TestClient(create_app())
    res = client.post("/screening/run", json={"universe": "mega"})
    assert res.status_code == 200
    payload = res.json()
    assert payload["columns"] == ["ticker", "score"]
    assert payload["rows"][0]["ticker"] == "AAA"
