from __future__ import annotations

from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.intelligence.weighting.models import (
    EvidenceLedger,
    WeightedSignal,
)


def test_ledger_defaults_and_roundtrip():
    ledger = EvidenceLedger(
        contributions=[
            WeightedSignal(
                key="insider_activity",
                label="Insider activity",
                category="positioning",
                direction="bullish",
                weight=10.0,
                contribution=10.0,
                source="Finnhub 90d",
            )
        ],
        bull_weight=10.0,
        bear_weight=0.0,
        net=10.0,
        balance_label="bullish",
    )

    assert EvidenceLedger.model_validate(ledger.model_dump()) == ledger


def test_symbol_intelligence_ledger_defaults_none():
    intelligence = SymbolIntelligence(
        symbol="AAPL",
        generated_at="2026-07-03T00:00:00+00:00",
        action="WATCH",
        conviction="low",
        summary_line="x",
        narrative="y",
    )

    assert intelligence.evidence_ledger is None
