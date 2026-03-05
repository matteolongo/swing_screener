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


def test_load_events_supports_symbol_filter_and_limit(tmp_path):
    storage = IntelligenceStorage(tmp_path)
    asof = date(2026, 2, 15)
    storage.write_events(
        [
            Event(
                event_id="evt-1",
                symbol="AAPL",
                source="yahoo_finance",
                occurred_at="2026-02-15T20:00:00",
                headline="AAPL raises guidance",
                event_type="news",
                credibility=0.8,
                metadata={"summary": "Guidance increased"},
            ),
            Event(
                event_id="evt-2",
                symbol="MSFT",
                source="yahoo_finance",
                occurred_at="2026-02-15T20:10:00",
                headline="MSFT cloud demand remains strong",
                event_type="news",
                credibility=0.75,
            ),
        ],
        asof,
    )

    filtered = storage.load_events(asof, symbols=["AAPL"])
    assert len(filtered) == 1
    assert filtered[0].symbol == "AAPL"
    assert filtered[0].metadata.get("summary") == "Guidance increased"

    limited = storage.load_events(asof, limit=1)
    assert len(limited) == 1


def test_load_signals_supports_symbol_filter_and_ordering(tmp_path):
    storage = IntelligenceStorage(tmp_path)
    asof = date(2026, 2, 15)
    storage.write_signals(
        [
            CatalystSignal(
                symbol="AAPL",
                event_id="evt-aapl",
                return_z=2.1,
                atr_shock=1.1,
                peer_confirmation_count=2,
                recency_hours=5.0,
                is_false_catalyst=False,
                reasons=["return_z>=1.5"],
            ),
            CatalystSignal(
                symbol="AAPL",
                event_id="evt-aapl-2",
                return_z=1.7,
                atr_shock=0.9,
                peer_confirmation_count=1,
                recency_hours=1.0,
                is_false_catalyst=False,
                reasons=["return_z>=1.5"],
            ),
            CatalystSignal(
                symbol="MSFT",
                event_id="evt-msft",
                return_z=1.8,
                atr_shock=1.0,
                peer_confirmation_count=2,
                recency_hours=3.0,
                is_false_catalyst=False,
                reasons=["return_z>=1.5"],
            ),
        ],
        asof,
    )

    aapl_only = storage.load_signals(asof, symbols=["AAPL"])
    assert len(aapl_only) == 2
    assert [signal.event_id for signal in aapl_only] == ["evt-aapl-2", "evt-aapl"]
