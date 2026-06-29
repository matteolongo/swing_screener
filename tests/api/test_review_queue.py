import json
from pathlib import Path

from api.repositories.review_queue_repo import ReviewQueueRepository
from api.repositories.symbol_pool_repo import SymbolPoolRepository


def _write(path: Path, data: dict):
    path.write_text(json.dumps(data), encoding="utf-8")


def test_pool_repo_apply_fetch_results(tmp_path):
    path = tmp_path / "symbol_pool.json"
    _write(
        path,
        {
            "schema_version": 1,
            "asof": "2026-06-29",
            "symbols": [
                {"symbol": "AAPL", "fetch_failure_count": 2},
                {"symbol": "MSFT", "fetch_failure_count": 0},
            ],
        },
    )
    repo = SymbolPoolRepository(path)
    crossed = repo.apply_fetch_results(
        ok=["MSFT"], failed=["AAPL"], asof="2026-06-30", threshold=3
    )
    assert [c["symbol"] for c in crossed] == ["AAPL"]  # 2 -> 3 crosses threshold
    data = repo.read()
    by = {s["symbol"]: s for s in data["symbols"]}
    assert by["AAPL"]["fetch_failure_count"] == 3
    assert by["MSFT"]["fetch_failure_count"] == 0
    assert by["MSFT"]["last_fetch_ok_at"] == "2026-06-30"


def test_review_queue_upsert_remove_restore(tmp_path):
    path = tmp_path / "review_queue.json"
    _write(path, {"entries": []})
    repo = ReviewQueueRepository(path)
    repo.upsert(
        [
            {
                "symbol": "AAPL",
                "exchange_mic": "XNAS",
                "failure_count": 3,
                "first_failed_at": "2026-06-28",
                "last_failed_at": "2026-06-30",
                "reason": "no data",
            }
        ]
    )
    assert [e["symbol"] for e in repo.list_entries()] == ["AAPL"]
    restored = repo.restore("AAPL")
    assert restored["symbol"] == "AAPL"
    assert repo.list_entries() == []
    repo.upsert([{"symbol": "MSFT", "failure_count": 3}])
    assert repo.remove("MSFT") is True
    assert repo.remove("MSFT") is False


def test_review_queue_self_creates_when_missing(tmp_path):
    path = tmp_path / "review_queue.json"
    repo = ReviewQueueRepository(path)
    assert repo.list_entries() == []
    repo.upsert([{"symbol": "TSLA", "failure_count": 3}])
    assert [e["symbol"] for e in repo.list_entries()] == ["TSLA"]
