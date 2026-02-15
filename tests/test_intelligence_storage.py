from datetime import date

from swing_screener.intelligence.models import (
    CatalystSignal,
    Event,
    Opportunity,
    SymbolState,
    ThemeCluster,
)
from swing_screener.intelligence.storage import IntelligenceStorage


def test_write_daily_snapshots(tmp_path):
    storage = IntelligenceStorage(tmp_path)
    asof = date(2026, 2, 15)

    events = [
        Event(
            event_id="evt-1",
            symbol="NVDA",
            source="yahoo_finance",
            occurred_at="2026-02-15T20:00:00",
            headline="NVIDIA posts strong quarter",
            event_type="earnings",
            credibility=0.9,
        )
    ]
    signals = [
        CatalystSignal(
            symbol="NVDA",
            event_id="evt-1",
            return_z=2.4,
            atr_shock=1.3,
            peer_confirmation_count=3,
            recency_hours=4.0,
            is_false_catalyst=False,
            reasons=["return_z>=1.5"],
        )
    ]
    themes = [
        ThemeCluster(
            theme_id="semis-2026-02-15",
            name="Semiconductor Momentum",
            symbols=["NVDA", "AMD", "AVGO"],
            cluster_strength=0.81,
        )
    ]
    opportunities = [
        Opportunity(
            symbol="NVDA",
            technical_readiness=0.77,
            catalyst_strength=0.85,
            opportunity_score=0.806,
            state="CATALYST_ACTIVE",
            explanations=["strong reaction", "peer confirmation"],
        )
    ]

    events_path = storage.write_events(events, asof)
    signals_path = storage.write_signals(signals, asof)
    themes_path = storage.write_themes(themes, asof)
    opps_path = storage.write_opportunities(opportunities, asof)

    assert events_path.name == "events_2026-02-15.jsonl"
    assert signals_path.name == "signals_2026-02-15.json"
    assert themes_path.name == "themes_2026-02-15.json"
    assert opps_path.name == "opportunities_2026-02-15.json"
    assert events_path.read_text(encoding="utf-8").strip() != ""
    assert signals_path.read_text(encoding="utf-8").strip().startswith("[")


def test_symbol_state_roundtrip(tmp_path):
    storage = IntelligenceStorage(tmp_path)
    state = [
        SymbolState(
            symbol="NVDA",
            state="WATCH",
            last_transition_at="2026-02-15T20:30:00",
            state_score=0.52,
            last_event_id="evt-1",
        ),
        SymbolState(
            symbol="SMCI",
            state="QUIET",
            last_transition_at="2026-02-15T20:30:00",
            state_score=0.0,
        ),
    ]

    storage.write_symbol_state(state)
    loaded = storage.load_symbol_state()

    assert set(loaded.keys()) == {"NVDA", "SMCI"}
    assert loaded["NVDA"].state == "WATCH"
    assert loaded["NVDA"].last_event_id == "evt-1"
    assert loaded["SMCI"].state_score == 0.0


def test_load_symbol_state_handles_missing_or_empty_file(tmp_path):
    storage = IntelligenceStorage(tmp_path)
    assert storage.load_symbol_state() == {}

    storage.symbol_state_path.write_text("", encoding="utf-8")
    assert storage.load_symbol_state() == {}

