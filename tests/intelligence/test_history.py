from swing_screener.intelligence.history import (
    append_history,
    entry_from_result,
    read_history,
)
from swing_screener.intelligence.models import SymbolIntelligence


def _result(summary: str, risks=None) -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol="AAPL",
        generated_at="2026-06-25T08:00:00Z",
        action="MANAGE_ONLY",
        conviction="medium",
        summary_line=summary,
        narrative="Text.",
        risk_factors=risks or [],
    )


def test_entry_from_result_uses_top_two_risks_as_watch_for():
    entry = entry_from_result(_result("hold", risks=["a", "b", "c"]))
    assert entry.watch_for == ["a", "b"]
    assert entry.action == "MANAGE_ONLY"
    assert entry.summary_line == "hold"


def test_append_then_read_newest_first(tmp_path):
    append_history("aapl", _result("first"), max_entries=50, history_root=tmp_path)
    append_history("AAPL", _result("second"), max_entries=50, history_root=tmp_path)
    entries = read_history("AAPL", history_root=tmp_path)
    assert [e.summary_line for e in entries] == ["second", "first"]


def test_append_caps_at_max_entries(tmp_path):
    for i in range(5):
        append_history("AAPL", _result(f"run-{i}"), max_entries=3, history_root=tmp_path)
    entries = read_history("AAPL", history_root=tmp_path)
    assert [e.summary_line for e in entries] == ["run-4", "run-3", "run-2"]


def test_read_limit(tmp_path):
    for i in range(4):
        append_history("AAPL", _result(f"run-{i}"), max_entries=50, history_root=tmp_path)
    entries = read_history("AAPL", limit=2, history_root=tmp_path)
    assert [e.summary_line for e in entries] == ["run-3", "run-2"]


def test_read_missing_returns_empty(tmp_path):
    assert read_history("NOPE", history_root=tmp_path) == []


def test_read_corrupt_returns_empty(tmp_path):
    (tmp_path / "history").mkdir(parents=True)
    (tmp_path / "history" / "AAPL.json").write_text("{not json")
    assert read_history("AAPL", history_root=tmp_path) == []
