import numpy as np
import pandas as pd

from swing_screener.indicators.candles import (
    CandleConfig,
    CandlePattern,
    _bar_metrics,
    _context_for_latest,
    _is_bearish_engulfing,
    _is_bullish_engulfing,
    _is_doji,
    _is_hammer,
    _is_inside_bar,
    _is_outside_bar,
    _is_shooting_star,
    detect_patterns,
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


def test_bullish_engulfing():
    prev = _bar(o=10.0, h=10.1, low=9.4, c=9.5)  # bearish
    cur = _bar(o=9.4, h=10.3, low=9.3, c=10.2)  # bullish, body engulfs prev body
    assert _is_bullish_engulfing(prev, cur) is True


def test_bearish_engulfing():
    prev = _bar(o=9.5, h=10.1, low=9.4, c=10.0)  # bullish
    cur = _bar(o=10.1, h=10.2, low=9.3, c=9.4)  # bearish, engulfs
    assert _is_bearish_engulfing(prev, cur) is True


def test_inside_bar():
    prev = _bar(o=9.5, h=10.5, low=9.0, c=10.0)
    cur = _bar(o=9.8, h=10.2, low=9.4, c=10.0)  # H/L inside prev
    assert _is_inside_bar(prev, cur) is True


def test_outside_bar():
    prev = _bar(o=9.8, h=10.2, low=9.4, c=10.0)
    cur = _bar(o=9.5, h=10.5, low=9.0, c=10.1)  # H/L contains prev
    assert _is_outside_bar(prev, cur) is True


def _close_series(values):
    idx = pd.date_range("2024-01-01", periods=len(values), freq="B")
    return pd.Series(values, index=idx)


def test_context_extended_when_far_above_prior_high():
    base = list(np.linspace(10, 20, 60))
    base[-1] = 30.0  # spike far above prior 50-bar high
    ctx = _context_for_latest(_close_series(base), CandleConfig())
    assert ctx == "extended"


def test_context_at_breakout():
    base = [10.0] * 60
    base[-1] = 10.05  # close above prior flat high, below extension threshold
    ctx = _context_for_latest(_close_series(base), CandleConfig())
    assert ctx == "at_breakout"


def test_context_none_for_flat_series():
    ctx = _context_for_latest(_close_series([10.0] * 60), CandleConfig())
    assert ctx == "none"


# ---------------------------------------------------------------------------
# Task 4: detect_patterns orchestrator + CandlePattern
# ---------------------------------------------------------------------------


def _ohlcv(rows, ticker="AAA"):
    # rows: list of (o,h,l,c,v); build (field,ticker) MultiIndex frame
    idx = pd.date_range("2024-01-01", periods=len(rows), freq="B")
    data = {}
    for fi, fname in enumerate(["Open", "High", "Low", "Close", "Volume"]):
        data[(fname, ticker)] = [r[fi] for r in rows]
    cols = pd.MultiIndex.from_tuples(list(data.keys()), names=["field", "ticker"])
    return pd.DataFrame({k: v for k, v in data.items()}, index=idx).reindex(
        columns=cols
    )


def test_detect_patterns_finds_latest_hammer_with_context():
    rows = [(10, 10.1, 9.9, 10.0, 1000)] * 59
    rows.append((10.0, 10.2, 8.0, 10.1, 1500))  # hammer on last bar
    out = detect_patterns(_ohlcv(rows), lookback=5)
    assert "AAA" in out
    names = {p.name for p in out["AAA"]}
    assert "hammer" in names
    hammer = next(p for p in out["AAA"] if p.name == "hammer")
    assert isinstance(hammer, CandlePattern)
    assert hammer.direction == "bullish"
    assert hammer.key_level == 8.0
    assert hammer.context in {"at_breakout", "at_pullback", "extended", "none"}


def test_detect_patterns_empty_for_short_series():
    rows = [(10, 10.1, 9.9, 10.0, 1000)] * 3
    result = detect_patterns(_ohlcv(rows))
    assert result == {"AAA": []} or result == {}


def test_detect_patterns_handles_missing_ohlc():
    idx = pd.date_range("2024-01-01", periods=5, freq="B")
    df = pd.DataFrame({("Close", "AAA"): [1, 2, 3, 4, 5]}, index=idx)
    df.columns = pd.MultiIndex.from_tuples(
        [("Close", "AAA")], names=["field", "ticker"]
    )
    result = detect_patterns(df)
    assert result == {} or result == {"AAA": []}


def test_detect_patterns_filters_requested_tickers():
    idx = pd.date_range("2024-01-01", periods=60, freq="B")
    rows_a = [(10, 10.1, 9.9, 10.0, 1000)] * 59 + [(10.0, 10.2, 8.0, 10.1, 1500)]
    rows_b = [(20, 20.1, 19.9, 20.0, 1000)] * 60
    data = {}
    for fi, fname in enumerate(["Open", "High", "Low", "Close", "Volume"]):
        data[(fname, "AAA")] = [r[fi] for r in rows_a]
        data[(fname, "BBB")] = [r[fi] for r in rows_b]
    cols = pd.MultiIndex.from_tuples(list(data.keys()), names=["field", "ticker"])
    df = pd.DataFrame({k: v for k, v in data.items()}, index=idx).reindex(columns=cols)

    out = detect_patterns(df, tickers=["aaa"], lookback=5)  # lowercase on purpose
    assert set(out.keys()) == {"AAA"}
