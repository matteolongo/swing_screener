from __future__ import annotations

from datetime import datetime, timezone

from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer
from tests.intelligence.test_analyzer_graph_equivalence import (
    _candidate_req,
    _mock_openai,
)


def test_ledger_attached_and_advisory(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    _mock_openai(monkeypatch)
    analyzer = SymbolAnalyzer()

    result = analyzer.analyze(
        "AAPL",
        _candidate_req(),
        now=datetime(2026, 7, 3, 15, 0, tzinfo=timezone.utc),
    )

    assert result.evidence_ledger is not None
    assert result.evidence_ledger.balance_label in {
        "strongly_bullish",
        "bullish",
        "mixed",
        "bearish",
        "strongly_bearish",
    }
    assert result.action == "BUY_ON_PULLBACK"
    assert result.conviction == "medium"
