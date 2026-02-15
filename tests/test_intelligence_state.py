from datetime import datetime

from swing_screener.intelligence.models import CatalystSignal, SymbolState, ThemeCluster
from swing_screener.intelligence.state import (
    StateMachinePolicy,
    transition_symbol_state,
    update_symbol_states,
)


def _signal(
    symbol: str,
    *,
    return_z: float,
    atr_shock: float,
    peers: int,
    recency: float,
    is_false: bool = False,
    event_id: str = "evt-1",
) -> CatalystSignal:
    return CatalystSignal(
        symbol=symbol,
        event_id=event_id,
        return_z=return_z,
        atr_shock=atr_shock,
        peer_confirmation_count=peers,
        recency_hours=recency,
        is_false_catalyst=is_false,
        reasons=[],
    )


def test_transition_strong_fresh_signal_activates_symbol():
    state = transition_symbol_state(
        symbol="AAPL",
        previous=None,
        signal=_signal("AAPL", return_z=2.5, atr_shock=1.6, peers=2, recency=4),
        asof_dt=datetime.fromisoformat("2026-02-20T00:00:00"),
        themed_symbols=set(),
    )
    assert state.state == "CATALYST_ACTIVE"
    assert state.last_event_id == "evt-1"
    assert state.state_score > 0.72


def test_transition_medium_signal_sets_watch():
    prev = SymbolState(
        symbol="AAPL",
        state="QUIET",
        last_transition_at="2026-02-18T00:00:00",
        state_score=0.0,
    )
    state = transition_symbol_state(
        symbol="AAPL",
        previous=prev,
        signal=_signal("AAPL", return_z=1.2, atr_shock=0.9, peers=0, recency=6),
        asof_dt=datetime.fromisoformat("2026-02-20T00:00:00"),
        themed_symbols=set(),
    )
    assert state.state == "WATCH"


def test_transition_false_signal_cools_active_symbol():
    prev = SymbolState(
        symbol="AAPL",
        state="TRENDING",
        last_transition_at="2026-02-18T00:00:00",
        state_score=0.8,
        last_event_id="older",
    )
    state = transition_symbol_state(
        symbol="AAPL",
        previous=prev,
        signal=_signal("AAPL", return_z=0.2, atr_shock=0.2, peers=0, recency=2, is_false=True),
        asof_dt=datetime.fromisoformat("2026-02-20T00:00:00"),
        themed_symbols=set(),
    )
    assert state.state == "COOLING_OFF"
    assert state.last_event_id == "evt-1"
    assert state.state_score < prev.state_score


def test_no_signal_expiry_transitions():
    now = datetime.fromisoformat("2026-02-20T00:00:00")
    policy = StateMachinePolicy(
        watch_expiry_hours=48,
        active_to_trending_hours=24,
        trending_to_cooling_hours=72,
        cooling_to_quiet_hours=48,
    )

    watch = transition_symbol_state(
        symbol="AAPL",
        previous=SymbolState("AAPL", "WATCH", "2026-02-17T00:00:00", 0.4),
        signal=None,
        asof_dt=now,
        themed_symbols=set(),
        policy=policy,
    )
    assert watch.state == "QUIET"

    active = transition_symbol_state(
        symbol="MSFT",
        previous=SymbolState("MSFT", "CATALYST_ACTIVE", "2026-02-18T00:00:00", 0.9),
        signal=None,
        asof_dt=now,
        themed_symbols=set(),
        policy=policy,
    )
    assert active.state == "TRENDING"

    trending = transition_symbol_state(
        symbol="NVDA",
        previous=SymbolState("NVDA", "TRENDING", "2026-02-15T00:00:00", 0.7),
        signal=None,
        asof_dt=now,
        themed_symbols=set(),
        policy=policy,
    )
    assert trending.state == "COOLING_OFF"


def test_update_symbol_states_applies_theme_boost_for_trending():
    prev = {
        "AAPL": SymbolState("AAPL", "CATALYST_ACTIVE", "2026-02-19T00:00:00", 0.8),
        "MSFT": SymbolState("MSFT", "QUIET", "2026-02-18T00:00:00", 0.0),
    }
    signals = [
        _signal("AAPL", return_z=1.7, atr_shock=1.1, peers=1, recency=52, event_id="e-aapl"),
        _signal("MSFT", return_z=2.0, atr_shock=1.2, peers=1, recency=10, event_id="e-msft"),
    ]
    themes = [
        ThemeCluster(
            theme_id="t-1",
            name="Peer Cluster",
            symbols=["AAPL", "MSFT"],
            cluster_strength=0.8,
            driver_signals=["e-aapl", "e-msft"],
        )
    ]

    next_states = update_symbol_states(
        previous_states=prev,
        signals=signals,
        themes=themes,
        asof_dt=datetime.fromisoformat("2026-02-20T00:00:00"),
    )

    assert next_states["AAPL"].state == "TRENDING"
    assert next_states["AAPL"].last_event_id == "e-aapl"
    assert next_states["MSFT"].state in {"WATCH", "CATALYST_ACTIVE", "TRENDING"}
    assert next_states["MSFT"].last_event_id == "e-msft"

