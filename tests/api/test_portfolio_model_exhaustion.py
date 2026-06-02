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
