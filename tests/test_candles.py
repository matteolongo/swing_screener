from swing_screener.indicators.candles import (
    CandleConfig,
    _bar_metrics,
    _is_doji,
    _is_hammer,
    _is_shooting_star,
)


def _bar(o, h, low, c):
    return _bar_metrics(o, h, low, c)


def test_hammer_true():
    # small body at top, long lower wick, tiny upper wick
    m = _bar(o=10.0, h=10.2, low=8.0, c=10.1)
    assert _is_hammer(m, CandleConfig()) is True


def test_hammer_false_when_lower_wick_too_short():
    m = _bar(o=10.0, h=10.2, low=9.95, c=10.1)
    assert _is_hammer(m, CandleConfig()) is False


def test_shooting_star_true():
    m = _bar(o=10.0, h=12.0, low=9.9, c=10.05)
    assert _is_shooting_star(m, CandleConfig()) is True


def test_doji_true():
    m = _bar(o=10.0, h=10.5, low=9.5, c=10.01)
    assert _is_doji(m, CandleConfig()) is True


def test_doji_false_when_body_large():
    m = _bar(o=10.0, h=10.6, low=9.9, c=10.5)
    assert _is_doji(m, CandleConfig()) is False
