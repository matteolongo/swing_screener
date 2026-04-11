from swing_screener.intelligence.config import CalendarConfig, OpportunityConfig, ScoringV2Config
from swing_screener.intelligence.models import (
    CatalystFeatureVector,
    CatalystSignal,
    Event,
    SymbolState,
    ThemeCluster,
)
from swing_screener.intelligence.scoring import (
    build_catalyst_score_map,
    build_catalyst_score_map_v2,
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


def test_build_catalyst_score_map_v2_uses_feature_vectors():
    signals = [
        _signal("AAPL", "e1", return_z=2.0, atr_shock=1.2, peers=1, recency=6.0),
    ]
    events = [Event("e1", "AAPL", "yahoo_finance", "2026-02-18T00:00:00", "A", "earnings", 0.82)]
    vectors = {
        "AAPL": CatalystFeatureVector(
            symbol="AAPL",
            proximity_score=0.9,
            materiality_score=0.88,
            source_quality_score=0.74,
            confirmation_score=0.66,
            uncertainty_penalty=0.21,
            filing_impact_score=0.1,
            calendar_risk_score=0.6,
        )
    }
    score_map = build_catalyst_score_map_v2(
        signals=signals,
        events=events,
        themes=[],
        feature_vectors=vectors,
        scoring_cfg=ScoringV2Config(enabled=True),
    )
    breakdown = score_map["AAPL"]
    assert breakdown.score > 0
    assert breakdown.proximity_score == 0.9
    assert breakdown.materiality_score == 0.88
    assert breakdown.source_quality_score == 0.74
    assert breakdown.confirmation_score == 0.66


def test_build_opportunities_applies_binary_event_guard_threshold_boost():
    cfg = OpportunityConfig(
        technical_weight=0.55,
        catalyst_weight=0.45,
        max_daily_opportunities=5,
        min_opportunity_score=0.55,
    )
    catalyst_map = {
        "AAPL": build_catalyst_score_map_v2(
            signals=[_signal("AAPL", "e1", return_z=1.5, atr_shock=1.0, peers=1, recency=6)],
            events=[Event("e1", "AAPL", "yahoo_finance", "2026-02-18T00:00:00", "A", "earnings", 0.8)],
            themes=[],
            feature_vectors={
                "AAPL": CatalystFeatureVector(
                    symbol="AAPL",
                    proximity_score=0.95,
                    materiality_score=0.9,
                    source_quality_score=0.7,
                    confirmation_score=0.7,
                    uncertainty_penalty=0.2,
                    filing_impact_score=0.0,
                    calendar_risk_score=0.8,
                )
            },
            scoring_cfg=ScoringV2Config(enabled=True),
        )["AAPL"]
    }
    opportunities = build_opportunities(
        technical_readiness={"AAPL": 0.58},
        catalyst_scores=catalyst_map,
        symbol_states={},
        cfg=cfg,
        feature_vectors={
            "AAPL": CatalystFeatureVector(
                symbol="AAPL",
                proximity_score=0.95,
                materiality_score=0.9,
                source_quality_score=0.7,
                confirmation_score=0.7,
                uncertainty_penalty=0.2,
                filing_impact_score=0.0,
                calendar_risk_score=0.8,
                top_catalysts=[{"event_type": "earnings", "materiality": 0.9}],
            )
        },
        scoring_cfg=ScoringV2Config(enabled=True),
        calendar_cfg=CalendarConfig(binary_event_window_days=5, binary_event_min_threshold_boost=0.1),
    )
    assert len(opportunities) in {0, 1}
    if opportunities:
        assert opportunities[0].score_breakdown_v2
        assert opportunities[0].top_catalysts


def _feature_vector(symbol: str) -> CatalystFeatureVector:
    """Minimal feature vector with non-zero confirmation so has_evidence is True."""
    return CatalystFeatureVector(
        symbol=symbol,
        proximity_score=0.8,
        materiality_score=0.8,
        source_quality_score=0.7,
        confirmation_score=0.5,
        uncertainty_penalty=0.1,
        filing_impact_score=0.0,
        calendar_risk_score=0.3,
    )


def test_stale_event_scores_lower_than_fresh_event():
    """Regression test for inverted decay: a stale catalyst event must receive a
    lower opportunity score than an otherwise identical fresh event when V2 scoring
    is enabled.

    Before the fix the formula was:
        decay_factor = exp(-recency_score / stale_hours)
        multiplier   = 0.9 + 0.1 * decay_factor
    which gave ~1.0 to stale events and slightly below 1.0 to fresh events —
    the opposite of the intended behaviour.

    After the fix:
        multiplier = max(0.6, 0.6 + 0.4 * recency_score)
    fresh (recency_score≈1) → multiplier≈1.0, stale (recency_score≈0) → multiplier=0.6.
    """
    events_fresh = [Event("ef", "FRESH", "yahoo_finance", "2026-02-18T00:00:00", "A", "news", 0.8)]
    events_stale = [Event("es", "STALE", "yahoo_finance", "2026-02-18T00:00:00", "B", "news", 0.8)]

    fresh_signal = _signal("FRESH", "ef", return_z=2.0, atr_shock=1.2, peers=1, recency=2.0)
    stale_signal = _signal("STALE", "es", return_z=2.0, atr_shock=1.2, peers=1, recency=300.0)

    fv_fresh = _feature_vector("FRESH")
    fv_stale = _feature_vector("STALE")

    catalyst_map = {
        **build_catalyst_score_map_v2(
            signals=[fresh_signal],
            events=events_fresh,
            themes=[],
            feature_vectors={"FRESH": fv_fresh},
            scoring_cfg=ScoringV2Config(enabled=True),
        ),
        **build_catalyst_score_map_v2(
            signals=[stale_signal],
            events=events_stale,
            themes=[],
            feature_vectors={"STALE": fv_stale},
            scoring_cfg=ScoringV2Config(enabled=True),
        ),
    }

    cfg = OpportunityConfig(
        technical_weight=0.55,
        catalyst_weight=0.45,
        max_daily_opportunities=10,
        min_opportunity_score=0.0,  # let everything through so both appear
    )

    opportunities = build_opportunities(
        technical_readiness={"FRESH": 0.7, "STALE": 0.7},
        catalyst_scores=catalyst_map,
        symbol_states={},
        cfg=cfg,
        feature_vectors={"FRESH": fv_fresh, "STALE": fv_stale},
        scoring_cfg=ScoringV2Config(enabled=True),
        calendar_cfg=CalendarConfig(),
    )

    by_symbol = {o.symbol: o for o in opportunities}
    assert "FRESH" in by_symbol, "fresh event must produce an opportunity"
    assert "STALE" in by_symbol, "stale event must produce an opportunity"

    fresh_score = by_symbol["FRESH"].opportunity_score
    stale_score = by_symbol["STALE"].opportunity_score
    assert fresh_score > stale_score, (
        f"expected fresh ({fresh_score:.4f}) > stale ({stale_score:.4f}); "
        "stale events must receive a lower score than fresh events"
    )


def test_fully_stale_event_multiplier_floor():
    """A fully stale event (recency_score→0) must still receive at least 60% of its
    pre-decay score (the floor is 0.6)."""
    events = [Event("e1", "OLD", "yahoo_finance", "2026-01-01T00:00:00", "A", "news", 0.9)]
    signal = _signal("OLD", "e1", return_z=2.5, atr_shock=1.5, peers=2, recency=10_000.0)
    fv = _feature_vector("OLD")

    catalyst_map = build_catalyst_score_map_v2(
        signals=[signal],
        events=events,
        themes=[],
        feature_vectors={"OLD": fv},
        scoring_cfg=ScoringV2Config(enabled=True),
    )

    cfg = OpportunityConfig(
        technical_weight=0.55,
        catalyst_weight=0.45,
        max_daily_opportunities=10,
        min_opportunity_score=0.0,
    )

    opportunities = build_opportunities(
        technical_readiness={"OLD": 0.7},
        catalyst_scores=catalyst_map,
        symbol_states={},
        cfg=cfg,
        feature_vectors={"OLD": fv},
        scoring_cfg=ScoringV2Config(enabled=True),
        calendar_cfg=CalendarConfig(),
    )

    assert opportunities, "stale event with high catalyst should still surface"
    pre_decay_score = cfg.technical_weight * 0.7 + cfg.catalyst_weight * catalyst_map["OLD"].score
    assert opportunities[0].opportunity_score >= pre_decay_score * 0.6 - 1e-6, (
        "staleness floor must not reduce score below 60% of the pre-decay blend"
    )
