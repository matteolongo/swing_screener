import pandas as pd

from swing_screener.selection.entries import (
    breakout_signal,
    pullback_reclaim_signal,
    build_signal_board,
    EntrySignalConfig,
)


def _make_ohlcv_for_signals():
    idx = pd.bdate_range("2023-01-02", periods=260)

    # AAA: breakout on last day (last close higher than previous 50 closes)
    close_aaa = pd.Series(100.0, index=idx, dtype=float)
    close_aaa.iloc[-60:-1] = 100.0
    close_aaa.iloc[-1] = 120.0  # breakout

    # BBB: pullback reclaim on last day:
    # yesterday below MA20, today above MA20
    close_bbb = pd.Series(100.0, index=idx, dtype=float)
    close_bbb.iloc[-30:-2] = 100.0
    close_bbb.iloc[-2] = 90.0  # dip below MA
    close_bbb.iloc[-1] = 110.0  # reclaim above MA

    # SPY: just filler
    close_spy = pd.Series(100.0, index=idx, dtype=float)

    def mk(close: pd.Series):
        open_ = close
        high = close + 1.0
        low = close - 1.0
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_a, h_a, l_a, c_a, v_a = mk(close_aaa)
    o_b, h_b, l_b, c_b, v_b = mk(close_bbb)
    o_s, h_s, l_s, c_s, v_s = mk(close_spy)

    data = {}
    for field, s_a, s_b, s_s in [
        ("Open", o_a, o_b, o_s),
        ("High", h_a, h_b, h_s),
        ("Low", l_a, l_b, l_s),
        ("Close", c_a, c_b, c_s),
        ("Volume", v_a, v_b, v_s),
    ]:
        data[(field, "AAA")] = s_a
        data[(field, "BBB")] = s_b
        data[(field, "SPY")] = s_s

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_breakout_signal_true():
    ohlcv = _make_ohlcv_for_signals()
    s = ohlcv["Close"]["AAA"]
    ok, lvl = breakout_signal(s, lookback=50)
    assert ok is True
    assert lvl == 100.0


def test_pullback_reclaim_signal_true():
    ohlcv = _make_ohlcv_for_signals()
    s = ohlcv["Close"]["BBB"]
    ok, ma = pullback_reclaim_signal(s, ma_window=20)
    assert ok is True
    assert ma > 0


def test_breakout_uses_exact_prior_window_and_current_bar():
    exact = pd.Series([10.0, 11.0, 9.0, 12.0])
    one_short = exact.iloc[1:]
    one_extra = pd.concat([pd.Series([99.0]), exact], ignore_index=True)

    assert breakout_signal(exact, lookback=3) == (True, 11.0)
    short_result, short_level = breakout_signal(one_short, lookback=3)
    assert short_result is False
    assert pd.isna(short_level)
    assert breakout_signal(one_extra, lookback=3) == (True, 11.0)


def test_pullback_ma_includes_exact_window_ending_at_each_comparison_bar():
    exact = pd.Series([10.0, 10.0, 5.0, 12.0])
    one_short = exact.iloc[1:]
    one_extra = pd.concat([pd.Series([99.0]), exact], ignore_index=True)

    assert pullback_reclaim_signal(exact, ma_window=3) == (True, 9.0)
    short_result, short_level = pullback_reclaim_signal(one_short, ma_window=3)
    assert short_result is False
    assert pd.isna(short_level)
    assert pullback_reclaim_signal(one_extra, ma_window=3) == (True, 9.0)


def test_signal_board_accepts_exact_configured_minimum_history():
    frame = _make_ohlcv_for_signals().tail(4)
    cfg = EntrySignalConfig(breakout_lookback=3, pullback_ma=3, min_history=4)

    exact = build_signal_board(frame, ["AAA"], cfg)
    one_short = build_signal_board(frame.tail(3), ["AAA"], cfg)

    assert "AAA" in exact.index
    assert one_short.empty


def test_build_signal_board_assigns_signals():
    ohlcv = _make_ohlcv_for_signals()
    board = build_signal_board(
        ohlcv,
        ["AAA", "BBB"],
        EntrySignalConfig(breakout_lookback=50, pullback_ma=20),
    )

    assert "AAA" in board.index
    assert "BBB" in board.index
    assert board.loc["AAA", "signal"] in ["breakout", "both"]
    assert board.loc["BBB", "signal"] in ["pullback", "both"]


def test_build_signal_board_skips_empty_series():
    ohlcv = _make_ohlcv_for_signals()
    ohlcv[("Close", "CCC")] = pd.NA
    ohlcv[("Open", "CCC")] = pd.NA
    ohlcv[("High", "CCC")] = pd.NA
    ohlcv[("Low", "CCC")] = pd.NA
    ohlcv[("Volume", "CCC")] = pd.NA
    ohlcv = ohlcv.sort_index(axis=1)

    board = build_signal_board(ohlcv, ["AAA", "CCC"], EntrySignalConfig())

    assert "AAA" in board.index
    assert "CCC" not in board.index


def test_build_signal_board_empty_result_has_expected_columns():
    ohlcv = _make_ohlcv_for_signals()
    board = build_signal_board(ohlcv, ["ZZZ"], EntrySignalConfig())

    assert isinstance(board, pd.DataFrame)
    assert board.empty
    assert list(board.columns) == [
        "last",
        "breakout50",
        "breakout_level",
        "pullback_ma20",
        "ma20_level",
        "signal",
    ]
