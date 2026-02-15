from swing_screener.intelligence.config import OpportunityConfig
from swing_screener.intelligence.models import CatalystSignal, Event, SymbolState, ThemeCluster
from swing_screener.intelligence.scoring import (
    build_catalyst_score_map,
    build_opportunities,
    score_catalyst_signal,
)


def _signal(
    symbol: str,
    event_id: str,
    *,
    return_z: float,
    atr_shock: float,
    peers: int = 0,
    recency: float = 12.0,
    is_false: bool = False,
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


def test_score_catalyst_signal_bounds_and_false_gate():
    s = _signal("AAPL", "e1", return_z=2.0, atr_shock=1.2, peers=2, recency=6.0)
    score = score_catalyst_signal(s, event_credibility=0.8, theme_strength=0.7)
    assert 0.0 <= score <= 1.0

    false_score = score_catalyst_signal(
        _signal("AAPL", "e1", return_z=3.0, atr_shock=2.0, is_false=True),
        event_credibility=1.0,
        theme_strength=1.0,
    )
    assert false_score == 0.0


def test_score_catalyst_signal_monotonicity_for_return_z():
    low = score_catalyst_signal(
        _signal("AAPL", "e1", return_z=1.0, atr_shock=1.0, peers=1, recency=8.0),
        event_credibility=0.7,
        theme_strength=0.3,
    )
    high = score_catalyst_signal(
        _signal("AAPL", "e1", return_z=2.5, atr_shock=1.0, peers=1, recency=8.0),
        event_credibility=0.7,
        theme_strength=0.3,
    )
    assert high > low


def test_build_catalyst_score_map_uses_best_signal_per_symbol():
    events = [
        Event("e1", "AAPL", "yahoo_finance", "2026-02-18T00:00:00", "A", "news", 0.6),
        Event("e2", "AAPL", "yahoo_finance", "2026-02-19T00:00:00", "B", "news", 0.9),
    ]
    themes = [ThemeCluster("t1", "Theme", ["AAPL"], 0.8, ["e1", "e2"])]
    signals = [
        _signal("AAPL", "e1", return_z=1.1, atr_shock=0.9, peers=0, recency=30),
        _signal("AAPL", "e2", return_z=2.3, atr_shock=1.3, peers=2, recency=6),
    ]

    score_map = build_catalyst_score_map(signals=signals, events=events, themes=themes)

    assert set(score_map.keys()) == {"AAPL"}
    assert score_map["AAPL"].event_id == "e2"
    assert score_map["AAPL"].score > 0.0
    assert score_map["AAPL"].theme_score == 0.8
    assert score_map["AAPL"].credibility_score == 0.9


def test_build_opportunities_respects_min_threshold_and_cap():
    cfg = OpportunityConfig(
        technical_weight=0.55,
        catalyst_weight=0.45,
        max_daily_opportunities=2,
        min_opportunity_score=0.5,
    )
    technical = {"AAPL": 0.9, "MSFT": 0.7, "TSLA": 0.2}
    catalyst_map = build_catalyst_score_map(
        signals=[
            _signal("AAPL", "e1", return_z=2.5, atr_shock=1.5, peers=2, recency=8),
            _signal("MSFT", "e2", return_z=1.8, atr_shock=1.0, peers=1, recency=12),
            _signal("TSLA", "e3", return_z=0.7, atr_shock=0.6, peers=0, recency=24),
        ]
    )
    states = {
        "AAPL": SymbolState("AAPL", "CATALYST_ACTIVE", "2026-02-19T00:00:00", 0.9, "e1"),
        "MSFT": SymbolState("MSFT", "WATCH", "2026-02-19T00:00:00", 0.5, "e2"),
        "TSLA": SymbolState("TSLA", "QUIET", "2026-02-19T00:00:00", 0.1, "e3"),
    }

    opportunities = build_opportunities(
        technical_readiness=technical,
        catalyst_scores=catalyst_map,
        symbol_states=states,
        cfg=cfg,
    )

    assert len(opportunities) == 2
    assert opportunities[0].symbol == "AAPL"
    assert opportunities[1].symbol == "MSFT"
    assert all(item.opportunity_score >= 0.5 for item in opportunities)


def test_build_opportunities_sorts_ties_deterministically_by_symbol():
    cfg = OpportunityConfig(
        technical_weight=0.5,
        catalyst_weight=0.5,
        max_daily_opportunities=5,
        min_opportunity_score=0.1,
    )
    technical = {"AAPL": 0.6, "MSFT": 0.6}
    catalyst_map = build_catalyst_score_map(
        signals=[
            _signal("AAPL", "e1", return_z=1.5, atr_shock=1.0, peers=1, recency=12),
            _signal("MSFT", "e2", return_z=1.5, atr_shock=1.0, peers=1, recency=12),
        ]
    )

    opportunities = build_opportunities(
        technical_readiness=technical,
        catalyst_scores=catalyst_map,
        symbol_states={},
        cfg=cfg,
    )

    assert [o.symbol for o in opportunities] == ["AAPL", "MSFT"]

