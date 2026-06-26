from swing_screener.intelligence.models import (
    PositionSignalAction,
    SymbolIntelligenceRequest,
)
from swing_screener.intelligence.symbol_analyzer import _fallback_position_fields


def _req(signal: str, r_now: float) -> SymbolIntelligenceRequest:
    return SymbolIntelligenceRequest(
        close=401.82,
        signal=signal,
        entry_price=383.04,
        entry=383.04,
        stop=346.30,
        r_now=r_now,
        days_open=10,
        currency="USD",
    )


def test_fallback_signal_hold_for_no_action():
    sig, key_numbers = _fallback_position_fields(_req("NO_ACTION", 0.51))
    assert sig.action == PositionSignalAction.HOLD
    assert sig.reason  # non-empty
    labels = {kn.label for kn in key_numbers}
    assert "Current R" in labels
    assert "Days held" in labels


def test_fallback_signal_exit_for_close_actions():
    for action in ("CLOSE_STOP_HIT", "CLOSE_TIME_EXIT", "CLOSE_EXIT_SIGNAL"):
        sig, _ = _fallback_position_fields(_req(action, -0.4))
        assert sig.action == PositionSignalAction.EXIT


def test_fallback_signal_hold_for_move_stop_up():
    sig, _ = _fallback_position_fields(_req("MOVE_STOP_UP", 1.2))
    assert sig.action == PositionSignalAction.HOLD


def test_fallback_key_numbers_have_string_values_and_sentiment():
    _, key_numbers = _fallback_position_fields(_req("NO_ACTION", 0.51))
    by_label = {kn.label: kn for kn in key_numbers}
    assert by_label["Current R"].value == "+0.51R"
    assert by_label["Current R"].sentiment == "bullish"
    assert by_label["Days held"].value == "10"
