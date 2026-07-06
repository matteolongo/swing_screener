"""Test exhaustion fields in PositionUpdate API model."""


def test_position_update_api_model_has_exhaustion_fields():
    from api.models.portfolio import PositionUpdate
    # Default None
    u = PositionUpdate(
        ticker="AAA", status="open", last=110.0, entry=100.0,
        stop_old=90.0, stop_suggested=100.0, shares=1,
        r_now=1.0, action="MOVE_STOP_UP", reason="test",
    )
    assert u.exhaustion_score is None
    assert u.exhaustion_label is None
    # With values
    u2 = PositionUpdate(
        ticker="AAA", status="open", last=110.0, entry=100.0,
        stop_old=90.0, stop_suggested=100.0, shares=1,
        r_now=1.0, action="MOVE_STOP_UP", reason="test",
        exhaustion_score=5.5, exhaustion_label="watch",
    )
    assert u2.exhaustion_score == 5.5
    assert u2.exhaustion_label == "watch"


def test_position_update_api_model_accepts_exit_signal_action():
    from api.models.portfolio import PositionUpdate

    update = PositionUpdate(
        ticker="AAA",
        status="open",
        last=94.0,
        entry=100.0,
        stop_old=90.0,
        stop_suggested=90.0,
        shares=1,
        r_now=-0.6,
        action="CLOSE_EXIT_SIGNAL",
        reason="Below SMA20 for 2d.",
    )

    assert update.action == "CLOSE_EXIT_SIGNAL"
