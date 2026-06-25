import pytest
from pydantic import ValidationError
from swing_screener.intelligence.models import (
    IntelligenceEvent, IntelligenceEventDirection, IntelligenceEventType,
    PositionOutlook, PositionSignal, PositionSignalAction, SymbolIntelligence, SymbolIntelligenceRequest,
)


def test_symbol_intelligence_request_defaults():
    req = SymbolIntelligenceRequest(close=48.5, signal="breakout")
    assert req.currency == "USD"
    assert req.entry is None
    assert req.sector is None


def test_symbol_intelligence_request_full():
    req = SymbolIntelligenceRequest(
        close=48.5,
        signal="breakout",
        entry=49.0,
        stop=44.0,
        sma_20=45.0,
        sma_50=40.0,
        sma_200=35.0,
        momentum_6m=32.5,
        momentum_12m=78.0,
        sector="Materials",
        sector_rs=0.03,
        sector_rotation_context={"fast_rs": 0.04, "slow_rs": 0.02, "in_rotation": True},
        currency="EUR",
    )
    assert req.close == 48.5
    assert req.currency == "EUR"
    assert req.sector_rs == 0.03
    assert req.sector_rotation_context == {"fast_rs": 0.04, "slow_rs": 0.02, "in_rotation": True}


def test_request_accepts_position_context():
    req = SymbolIntelligenceRequest(
        close=50.0, signal="breakout",
        entry_price=48.0, r_now=1.5, days_open=7,
    )
    assert req.entry_price == 48.0
    assert req.r_now == 1.5
    assert req.days_open == 7


def test_request_position_context_optional():
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    assert req.entry_price is None
    assert req.r_now is None
    assert req.days_open is None


def test_symbol_intelligence_valid_action():
    intel = SymbolIntelligence(
        symbol="APAM",
        generated_at="2026-05-23T10:00:00",
        action="BUY_NOW",
        conviction="high",
        summary_line="Cyclical recovery play with improving EBITDA.",
        narrative="## Why it's moving\n...",
        sources=["https://example.com"],
    )
    assert intel.action == "BUY_NOW"
    assert intel.conviction == "high"


def test_symbol_intelligence_rejects_invalid_action():
    with pytest.raises(ValidationError):
        SymbolIntelligence(
            symbol="APAM",
            generated_at="2026-05-23T10:00:00",
            action="INVALID_ACTION",
            conviction="high",
            summary_line="x",
            narrative="x",
            sources=[],
        )


def test_symbol_intelligence_has_new_fields():
    intel = SymbolIntelligence(
        symbol="AAPL", generated_at="2026-05-24T10:00:00Z",
        action="BUY_NOW", conviction="high",
        catalyst_urgency="high",
        summary_line="Strong breakout.",
        narrative="## Why\nText.",
        upcoming_events=[
            IntelligenceEvent(
                type=IntelligenceEventType.earnings,
                date="2026-05-28",
                direction=IntelligenceEventDirection.bullish,
                summary="Q2 earnings expected to beat consensus.",
            )
        ],
        position_signal=PositionSignal(action=PositionSignalAction.HOLD, reason="Thesis intact."),
        position_outlook=PositionOutlook(
            expected_holding_period="1-2_weeks",
            hold_until="Hold while price stays above SMA20 and catalyst momentum persists.",
            next_review_trigger="Reassess after earnings or a close below SMA20.",
            thesis_status="intact",
            invalidation_signals=["Close below SMA20", "Earnings guide-down"],
            profit_management="trail_stop",
            opportunity_cost="medium",
            confidence_decay="If no breakout occurs within two weeks, confidence fades.",
        ),
        sources=[],
    )
    assert intel.catalyst_urgency == "high"
    assert len(intel.upcoming_events) == 1
    assert intel.upcoming_events[0].type == "earnings"
    assert intel.position_signal is not None
    assert intel.position_signal.action == "HOLD"
    assert intel.position_outlook is not None
    assert intel.position_outlook.expected_holding_period == "1-2_weeks"
    assert intel.position_outlook.thesis_status == "intact"
    assert intel.position_outlook.profit_management == "trail_stop"


def test_symbol_intelligence_defaults():
    intel = SymbolIntelligence(
        symbol="X", generated_at="2026-05-24T10:00:00Z",
        action="WATCH", conviction="low",
        catalyst_urgency="none",
        summary_line="Flat.", narrative="Text.", sources=[],
    )
    assert intel.upcoming_events == []
    assert intel.position_signal is None
    assert intel.position_outlook is None


def test_symbol_intelligence_new_fields_default_empty():
    from swing_screener.intelligence.models import SymbolIntelligence
    intel = SymbolIntelligence(
        symbol="AAPL",
        generated_at="2026-06-02T10:00:00Z",
        action="BUY_NOW",
        conviction="high",
        summary_line="Test.",
        narrative="Test narrative.",
    )
    assert intel.price_hook is None
    assert intel.key_numbers == []
    assert intel.risk_factors == []
    assert intel.prediction_bullets == []
    assert intel.past_trades_context is None


def test_pre_open_outlook_and_thesis_delta_round_trip():
    from swing_screener.intelligence.models import (
        PreOpenDriver, PreOpenOutlook, ThesisDelta,
    )
    intel = SymbolIntelligence(
        symbol="AAPL", generated_at="2026-06-25T08:00:00Z",
        action="MANAGE_ONLY", conviction="medium",
        summary_line="Hold into the open; modest gap up likely.",
        narrative="Text.",
        pre_open_outlook=PreOpenOutlook(
            gap_direction="gap_up",
            magnitude="moderate",
            primary_driver=PreOpenDriver(summary="Beat overnight.", source_url="https://x"),
            action_at_open="Let it open, don't chase.",
            stop_gap_plan="If it gaps below 180, exit at open.",
            confidence="medium",
        ),
        thesis_delta=ThesisDelta(
            status="confirmed",
            summary="Thesis intact since last run.",
            what_played_out=["Earnings beat as flagged"],
        ),
    )
    dumped = intel.model_dump_json()
    again = SymbolIntelligence.model_validate_json(dumped)
    assert again.pre_open_outlook is not None
    assert again.pre_open_outlook.gap_direction == "gap_up"
    assert again.pre_open_outlook.primary_driver.source_url == "https://x"
    assert again.thesis_delta is not None
    assert again.thesis_delta.status == "confirmed"
    assert again.thesis_delta.what_played_out == ["Earnings beat as flagged"]


def test_pre_open_and_thesis_default_none():
    intel = SymbolIntelligence(
        symbol="X", generated_at="2026-06-25T08:00:00Z",
        action="WATCH", conviction="low",
        summary_line="Flat.", narrative="Text.",
    )
    assert intel.pre_open_outlook is None
    assert intel.thesis_delta is None


def test_key_number_sentiment_values():
    from swing_screener.intelligence.models import KeyNumber
    kn = KeyNumber(label="SMA20", value="€266", sentiment="bullish")
    assert kn.sentiment == "bullish"


def test_key_number_value_coerces_numeric_llm_output_to_string():
    from swing_screener.intelligence.models import KeyNumber

    kn = KeyNumber(label="SMA20", value=322.77, sentiment="bullish")

    assert kn.value == "322.77"


def test_prediction_bullet_direction_values():
    from swing_screener.intelligence.models import PredictionBullet
    pb = PredictionBullet(direction="bearish", reason="Stretched valuation", reference="fair value range")
    assert pb.direction == "bearish"
    assert pb.reference == "fair value range"


def test_symbol_intelligence_accepts_new_fields():
    from swing_screener.intelligence.models import SymbolIntelligence, KeyNumber, PredictionBullet
    intel = SymbolIntelligence(
        symbol="BESI.AS",
        generated_at="2026-06-02T10:00:00Z",
        action="BUY_ON_PULLBACK",
        conviction="medium",
        summary_line="Test.",
        narrative="Test narrative.",
        price_hook="Tight consolidation near 52w high with sector tailwind.",
        key_numbers=[KeyNumber(label="SMA20", value="€266", sentiment="bullish")],
        risk_factors=["Valuation stretched vs fair value."],
        prediction_bullets=[PredictionBullet(direction="bullish", reason="SMA20 support", reference="technical")],
        past_trades_context="Prior stop at €247 — now key support.",
    )
    assert intel.price_hook == "Tight consolidation near 52w high with sector tailwind."
    assert len(intel.key_numbers) == 1
    assert intel.key_numbers[0].label == "SMA20"
    assert len(intel.risk_factors) == 1
    assert len(intel.prediction_bullets) == 1
    assert intel.past_trades_context == "Prior stop at €247 — now key support."
