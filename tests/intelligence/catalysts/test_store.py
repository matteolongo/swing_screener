from __future__ import annotations
import json
from datetime import date, datetime, timezone
from pathlib import Path
import pytest
from swing_screener.intelligence.catalysts.models import (
    CatalystOpportunity, CatalystOpportunityState, CatalystReport, MarketTheme,
)
from swing_screener.intelligence.catalysts.store import CatalystStore


def _make_report(report_id: str = "r1") -> CatalystReport:
    return CatalystReport(
        report_id=report_id,
        event_summary="Test event.",
        themes=[MarketTheme(name="AI infra", summary="Demand rising.", time_horizon="short_term", confidence=0.8)],
        causal_chains=[], beneficiaries=[], losers=[], hidden_opportunities=[],
        non_actionable_notes=[],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _make_opportunity(ticker: str = "AAPL", report_id: str = "r1") -> CatalystOpportunity:
    return CatalystOpportunity(
        ticker=ticker, state=CatalystOpportunityState.CATALYST_ACTIVE,
        catalyst_strength=8.0, thesis="Strong AI demand.", key_risks=["competition"],
        sources=["https://example.com/1"], report_id=report_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def test_save_and_load_report_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    report = _make_report("r1")
    store.save_report(report)
    loaded = store.load_report("r1")
    assert loaded is not None
    assert loaded.report_id == "r1"
    assert loaded.event_summary == "Test event."


def test_load_report_returns_none_for_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    assert store.load_report("nonexistent") is None


def test_load_latest_report_returns_most_recent(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    r1 = _make_report("r1")
    r2 = _make_report("r2")
    store.save_report(r1)
    store.save_report(r2)
    latest = store.load_latest_report()
    assert latest is not None
    assert latest.report_id == "r2"


def test_save_symbol_index_merges_across_reports(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    d = date(2026, 5, 24)
    opp_aapl = _make_opportunity("AAPL", "r1")
    opp_msft = _make_opportunity("MSFT", "r2")
    store.save_symbol_index(d, [opp_aapl])
    store.save_symbol_index(d, [opp_msft])  # second call must not overwrite AAPL
    aapl = store.load_symbol_opportunity("AAPL", d)
    msft = store.load_symbol_opportunity("MSFT", d)
    assert aapl is not None
    assert msft is not None


def test_symbol_lookup_is_case_insensitive(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    d = date(2026, 5, 24)
    store.save_symbol_index(d, [_make_opportunity("aapl")])
    assert store.load_symbol_opportunity("AAPL", d) is not None


def test_load_symbol_opportunity_returns_none_for_different_date(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    store.save_symbol_index(date(2026, 5, 23), [_make_opportunity("AAPL")])
    assert store.load_symbol_opportunity("AAPL", date(2026, 5, 24)) is None


def test_corrupt_json_handled_safely(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    store = CatalystStore()
    (tmp_path / "intelligence" / "catalyst_reports" / "by_symbol").mkdir(parents=True, exist_ok=True)
    corrupt_path = tmp_path / "intelligence" / "catalyst_reports" / "by_symbol" / "2026-05-24.json"
    corrupt_path.write_text("{bad json}")
    assert store.load_symbol_opportunity("AAPL", date(2026, 5, 24)) is None


def test_load_symbol_opportunity_returns_none_for_stale(tmp_path, monkeypatch):
    """An opportunity older than the stale threshold returns None."""
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from datetime import timedelta
    store = CatalystStore()
    stale_date = date.today() - timedelta(days=4)
    store.save_symbol_index(stale_date, [_make_opportunity("AAPL")])
    # load without specifying a date → uses today → stale entry not returned
    result = store.load_symbol_opportunity("AAPL")
    assert result is None  # today's index is empty
