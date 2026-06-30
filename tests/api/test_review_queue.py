from pathlib import Path

from api.repositories.review_queue_repo import ReviewQueueRepository


def test_apply_fetch_results_increments_and_resets(tmp_path: Path):
    repo = ReviewQueueRepository(tmp_path / "review_queue.json")
    # AAPL fails twice → count 2 (below threshold 3).
    repo.apply_fetch_results(ok=[], failed=["AAPL"], asof="2026-06-28", threshold=3)
    repo.apply_fetch_results(ok=[], failed=["AAPL"], asof="2026-06-29", threshold=3)
    assert repo.queued_symbols(3) == set()
    # Third failure crosses the threshold.
    repo.apply_fetch_results(ok=[], failed=["AAPL"], asof="2026-06-30", threshold=3)
    assert repo.queued_symbols(3) == {"AAPL"}
    entries = repo.list_entries(3)
    assert [e["symbol"] for e in entries] == ["AAPL"]
    assert entries[0]["fetch_failure_count"] == 3
    assert entries[0]["first_failed_at"] == "2026-06-28"
    assert entries[0]["last_failed_at"] == "2026-06-30"
    # A successful fetch resets the counter.
    repo.apply_fetch_results(ok=["AAPL"], failed=[], asof="2026-07-01", threshold=3)
    assert repo.queued_symbols(3) == set()


def test_remove_and_restore(tmp_path: Path):
    repo = ReviewQueueRepository(tmp_path / "review_queue.json")
    for _ in range(3):
        repo.apply_fetch_results(ok=[], failed=["MSFT"], asof="2026-06-30", threshold=3)
    assert repo.queued_symbols(3) == {"MSFT"}
    restored = repo.restore("MSFT")
    assert restored["symbol"] == "MSFT"
    assert repo.queued_symbols(3) == set()
    # Re-flag then hard-remove.
    for _ in range(3):
        repo.apply_fetch_results(ok=[], failed=["MSFT"], asof="2026-06-30", threshold=3)
    assert repo.remove("MSFT") is True
    assert repo.remove("MSFT") is False


def test_self_creates_when_missing(tmp_path: Path):
    repo = ReviewQueueRepository(tmp_path / "review_queue.json")
    assert repo.list_entries(3) == []
    assert repo.queued_symbols(3) == set()
