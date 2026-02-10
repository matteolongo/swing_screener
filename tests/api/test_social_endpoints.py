from datetime import datetime

from fastapi.testclient import TestClient

from api.main import app
import api.services.social_service as social_service
import swing_screener.strategy.storage as strategy_storage
from swing_screener.social.models import SocialRawEvent


def _patch_strategy_storage(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    monkeypatch.setattr(strategy_storage, "DATA_DIR", data_dir)
    monkeypatch.setattr(strategy_storage, "STRATEGIES_FILE", data_dir / "strategies.json")
    monkeypatch.setattr(strategy_storage, "ACTIVE_STRATEGY_FILE", data_dir / "active_strategy.json")


def test_social_analyze_returns_raw_events_when_no_data(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)

    def fake_analyze(
        symbol: str,
        *,
        lookback_hours: int,
        min_sample_size: int,
        provider_name: str = "reddit",
        max_events: int = 100,
    ):
        return {
            "status": "no_data",
            "symbol": symbol,
            "provider": provider_name,
            "lookback_hours": lookback_hours,
            "last_execution_at": "2026-02-09T09:00:00",
            "sample_size": min_sample_size - 1,
            "sentiment_score": 0.1,
            "sentiment_confidence": 0.2,
            "attention_score": 3.0,
            "attention_z": None,
            "hype_score": None,
            "reasons": ["LOW_SAMPLE_SIZE_NO_ACTION"],
            "raw_events": [
                SocialRawEvent(
                    source="reddit",
                    symbol=symbol,
                    timestamp=datetime(2026, 2, 9, 8, 0, 0),
                    text="test event",
                    author_id_hash="hash",
                    upvotes=5,
                    url="https://www.reddit.com/r/stocks/comments/test",
                    metadata={"subreddit": "stocks", "id": "test"},
                )
            ],
        }

    monkeypatch.setattr(social_service, "analyze_social_symbol", fake_analyze)

    client = TestClient(app)
    res = client.post("/api/social/analyze", json={"symbol": "TSLA"})
    assert res.status_code == 200
    payload = res.json()
    assert payload["status"] == "no_data"
    assert payload["symbol"] == "TSLA"
    assert payload["raw_events"]
    assert payload["raw_events"][0]["symbol"] == "TSLA"
