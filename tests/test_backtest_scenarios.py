"""
Comprehensive scenario tests for the backtesting engine.

These tests validate critical edge cases in trade execution logic,
including gap handling, stop management, and time-based exits.
"""

import pandas as pd
import pytest

from swing_screener.backtest.simulator import (
    backtest_single_ticker_R,
    BacktestConfig,
)


def _make_ohlcv(data):
    """Helper to construct OHLCV DataFrame with MultiIndex columns."""
    df = pd.DataFrame(data)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_stop_hit_on_gap_down():
    """
    Test 1: Gap-Down Through Stop
    
    Scenario: Price gaps down below the stop-loss at market open.
    Expected: Exit at the open price with exit_type='stop'.
    """
    idx = pd.date_range("2023-01-02", periods=4, freq="D")
    
    # Setup: normal trading for first 3 days
    close = pd.Series([100.0, 105.0, 105.0, 105.0], index=idx, dtype=float)
    open_ = close.copy()
    high = pd.Series([102.0, 107.0, 107.0, 107.0], index=idx, dtype=float)
    low = pd.Series([99.0, 104.0, 104.0, 104.0], index=idx, dtype=float)
    
    # Day 4: gap down through stop
    open_.iloc[3] = 85.0  # Gap down at open
    low.iloc[3] = 84.0
    close.iloc[3] = 87.0
    high.iloc[3] = 89.0
    
    vol = pd.Series(1_000_000, index=idx, dtype=float)
    
    ohlcv = _make_ohlcv(
        {
            ("Open", "AAPL"): open_,
            ("High", "AAPL"): high,
            ("Low", "AAPL"): low,
            ("Close", "AAPL"): close,
            ("Volume", "AAPL"): vol,
        }
    )
    
    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        exit_mode="take_profit",
        take_profit_R=2.0,
        max_holding_days=10,
        min_history=1,
        slippage_bps=0.0,
        fx_pct=0.0,
        commission_pct=0.0,
    )
    
    trades = backtest_single_ticker_R(ohlcv, "AAPL", cfg)
    
    assert not trades.empty, "Should have generated a trade"
    assert trades.iloc[0]["exit_type"] == "stop", "Exit should be due to stop"
    assert trades.iloc[0]["exit"] == 85.0, "Exit price should be the gap-down open price"
    # Verify it's a loss
    assert trades.iloc[0]["R"] < 0, "Should be a losing trade"


def test_gap_up_through_take_profit():
    """
    Test 2: Gap-Up Through Take-Profit
    
    Scenario: Price gaps up through the take-profit level at market open.
    Expected: Exit at the open price with exit_type='take_profit'.
    """
    idx = pd.date_range("2023-01-02", periods=4, freq="D")
    
    # Setup: normal trading
    close = pd.Series([100.0, 105.0, 105.0, 105.0], index=idx, dtype=float)
    open_ = close.copy()
    high = pd.Series([101.0, 106.0, 106.0, 106.0], index=idx, dtype=float)
    low = pd.Series([99.0, 104.0, 104.0, 104.0], index=idx, dtype=float)
    
    # Day 4: gap up through take-profit
    open_.iloc[3] = 120.0  # Gap up well above TP
    high.iloc[3] = 125.0
    low.iloc[3] = 119.0
    close.iloc[3] = 122.0
    
    vol = pd.Series(1_000_000, index=idx, dtype=float)
    
    ohlcv = _make_ohlcv(
        {
            ("Open", "TSLA"): open_,
            ("High", "TSLA"): high,
            ("Low", "TSLA"): low,
            ("Close", "TSLA"): close,
            ("Volume", "TSLA"): vol,
        }
    )
    
    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        exit_mode="take_profit",
        take_profit_R=2.0,  # Will be around 107-108
        max_holding_days=10,
        min_history=1,
        slippage_bps=0.0,
        fx_pct=0.0,
        commission_pct=0.0,
    )
    
    trades = backtest_single_ticker_R(ohlcv, "TSLA", cfg)
    
    assert not trades.empty, "Should have generated a trade"
    assert trades.iloc[0]["exit_type"] == "take_profit", "Exit should be due to take_profit"
    assert trades.iloc[0]["exit"] == 120.0, "Exit price should be the gap-up open price"
    # Verify it's a win
    assert trades.iloc[0]["R"] > 0, "Should be a winning trade"


def test_stop_hit_intraday_by_low():
    """
    Test 3: Stop Hit by Low of Bar Intra-Day
    
    Scenario: Stop is breached by the low of the bar during the day (not at open).
    Expected: Exit at the stop price with exit_type='stop'.
    """
    idx = pd.date_range("2023-01-02", periods=6, freq="D")
    
    # Breakout on day 1 (close 105 > 100), entry on day 2 at open=105
    # ATR on day 1 is 6.0, so stop will be at 105 - 6 = 99
    close = pd.Series([100.0, 105.0, 105.5, 105.5, 105.5, 105.5], index=idx, dtype=float)
    open_ = pd.Series([100.0, 105.0, 105.0, 105.5, 105.5, 105.5], index=idx, dtype=float)
    high = pd.Series([101.0, 106.0, 106.0, 106.0, 106.0, 106.0], index=idx, dtype=float)
    low = pd.Series([99.0, 104.0, 104.5, 104.5, 104.5, 104.5], index=idx, dtype=float)
    
    # Day 6: Low breaches the stop intraday (open above stop=99, but low below)
    low.iloc[5] = 98.5  # This will hit the stop=99.0 intraday
    
    vol = pd.Series(1_000_000, index=idx, dtype=float)
    
    ohlcv = _make_ohlcv(
        {
            ("Open", "NVDA"): open_,
            ("High", "NVDA"): high,
            ("Low", "NVDA"): low,
            ("Close", "NVDA"): close,
            ("Volume", "NVDA"): vol,
        }
    )
    
    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        exit_mode="take_profit",
        take_profit_R=2.0,
        max_holding_days=10,
        min_history=1,
        slippage_bps=0.0,
        fx_pct=0.0,
        commission_pct=0.0,
    )
    
    trades = backtest_single_ticker_R(ohlcv, "NVDA", cfg)
    
    assert not trades.empty, "Should have generated a trade"
    assert trades.iloc[0]["exit_type"] == "stop", "Exit should be due to stop"
    # Exit should be at the stop price, not the low
    assert trades.iloc[0]["exit"] == trades.iloc[0]["stop"], "Exit price should be at stop level"
    # Verify stop is at 99.0 (entry 105 - ATR 6.0)
    assert trades.iloc[0]["stop"] == 99.0, f"Stop should be 99.0, got {trades.iloc[0]['stop']}"


def test_breakeven_stop_at_one_R():
    """
    Test 4: Breakeven Stop Triggered When R >= 1.0
    
    Scenario: Trade moves favorably to R=1.0, triggering breakeven stop rule.
    The stop should move to entry price, and trade exits at breakeven.
    Expected: Stop moves to entry price when R >= 1.0.
    """
    idx = pd.date_range("2023-01-02", periods=7, freq="D")
    
    # Breakout on day 1 (close 101 > 100), entry on day 2 at open=101
    # Entry at 101, initial stop at ~100 (ATR=1, k_atr=1)
    # Move to 102 (R=1.0), then pull back to test breakeven
    close = pd.Series([100.0, 101.0, 102.0, 102.5, 102.0, 101.5, 101.0], index=idx, dtype=float)
    open_ = pd.Series([100.0, 101.0, 101.0, 102.0, 102.5, 102.0, 101.5], index=idx, dtype=float)
    high = pd.Series([100.5, 101.5, 102.5, 103.0, 102.5, 102.0, 101.5], index=idx, dtype=float)
    low = pd.Series([99.0, 100.0, 101.0, 102.0, 101.5, 101.0, 100.5], index=idx, dtype=float)
    
    # Day 7: Price dips to hit the breakeven stop
    low.iloc[6] = 100.8  # Just below entry=101
    
    vol = pd.Series(1_000_000, index=idx, dtype=float)
    
    ohlcv = _make_ohlcv(
        {
            ("Open", "MSFT"): open_,
            ("High", "MSFT"): high,
            ("Low", "MSFT"): low,
            ("Close", "MSFT"): close,
            ("Volume", "MSFT"): vol,
        }
    )
    
    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        exit_mode="trailing_stop",  # Enables breakeven logic
        breakeven_at_R=1.0,  # Move to breakeven at 1R
        trail_after_R=5.0,  # Won't activate trailing yet
        trail_sma=3,
        sma_buffer_pct=0.0,
        max_holding_days=20,
        min_history=1,
        slippage_bps=0.0,
        fx_pct=0.0,
        commission_pct=0.0,
    )
    
    trades = backtest_single_ticker_R(ohlcv, "MSFT", cfg)
    
    assert not trades.empty, "Should have generated a trade"
    assert trades.iloc[0]["exit_type"] == "stop", "Exit should be due to stop"
    # R should be approximately 0 (breakeven)
    assert -0.2 < trades.iloc[0]["R"] < 0.2, f"Should exit near breakeven, got R={trades.iloc[0]['R']}"


def test_trailing_stop_activation_and_movement():
    """
    Test 5: Trailing Stop Activated at R >= 2.0 and Moves with SMA
    
    Scenario: Trade reaches R=2.0, activating trailing stop that follows SMA.
    As price continues up, stop should trail upward below the SMA.
    Expected: Exit occurs at trailing stop level above original stop.
    """
    idx = pd.date_range("2023-01-02", periods=10, freq="D")
    
    # Breakout on day 1 (close 101 > 100), entry on day 2 at open=101
    # Entry at 101, initial stop at ~100 (ATR=1, k_atr=1)
    # Move up to trigger trailing (R=2.0 at 103), continue up, then pull back
    close = pd.Series(
        [100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 105.5, 104.0, 103.0],
        index=idx,
        dtype=float,
    )
    open_ = pd.Series(
        [100.0, 101.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 105.5, 104.0],
        index=idx,
        dtype=float,
    )
    high = pd.Series(
        [100.5, 101.5, 102.5, 103.5, 104.5, 105.5, 106.5, 106.5, 105.5, 104.0],
        index=idx,
        dtype=float,
    )
    low = pd.Series(
        [99.0, 100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 105.0, 103.5, 102.0],
        index=idx,
        dtype=float,
    )
    
    vol = pd.Series(1_000_000, index=idx, dtype=float)
    
    ohlcv = _make_ohlcv(
        {
            ("Open", "GOOGL"): open_,
            ("High", "GOOGL"): high,
            ("Low", "GOOGL"): low,
            ("Close", "GOOGL"): close,
            ("Volume", "GOOGL"): vol,
        }
    )
    
    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        exit_mode="trailing_stop",
        breakeven_at_R=1.0,
        trail_after_R=2.0,  # Activate trailing at 2R
        trail_sma=3,  # 3-period SMA
        sma_buffer_pct=0.01,  # 1% below SMA
        max_holding_days=20,
        min_history=1,
        slippage_bps=0.0,
        fx_pct=0.0,
        commission_pct=0.0,
    )
    
    trades = backtest_single_ticker_R(ohlcv, "GOOGL", cfg)
    
    assert not trades.empty, "Should have generated a trade"
    assert trades.iloc[0]["exit_type"] == "stop", "Exit should be due to (trailing) stop"
    # The trailing stop should have moved above the original stop
    # Original stop was ~100, trailing stop should be much higher (around 103+)
    assert trades.iloc[0]["exit"] > 101.0, "Trailing stop should be above entry price"
    # R should be positive since we trailed upward
    assert trades.iloc[0]["R"] > 0.5, "Should be a winning trade due to trailing stop"


def test_time_stop_max_holding_days():
    """
    Test 6: Time Stop Exit After max_holding_days
    
    Scenario: Trade reaches max_holding_days without hitting stop or take-profit.
    Expected: Exit at close price with exit_type='time' after exactly max_holding_days bars.
    """
    idx = pd.date_range("2023-01-02", periods=8, freq="D")
    
    # Breakout on day 1 (close 101 > 100), entry on day 2 at open=101
    # Hold for exactly 4 bars (max_holding_days=4)
    # Price stays relatively flat, no stop or TP hit
    close = pd.Series([100.0, 101.0, 102.0, 102.0, 102.0, 102.0, 102.0, 102.0], index=idx, dtype=float)
    open_ = pd.Series([100.0, 101.0, 101.0, 102.0, 102.0, 102.0, 102.0, 102.0], index=idx, dtype=float)
    high = pd.Series([100.5, 101.5, 102.5, 102.5, 102.5, 102.5, 102.5, 102.5], index=idx, dtype=float)
    low = pd.Series([99.0, 100.0, 101.0, 101.5, 101.5, 101.5, 101.5, 101.5], index=idx, dtype=float)
    
    vol = pd.Series(1_000_000, index=idx, dtype=float)
    
    ohlcv = _make_ohlcv(
        {
            ("Open", "AMZN"): open_,
            ("High", "AMZN"): high,
            ("Low", "AMZN"): low,
            ("Close", "AMZN"): close,
            ("Volume", "AMZN"): vol,
        }
    )
    
    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        exit_mode="take_profit",
        take_profit_R=10.0,  # Very high, won't be hit
        max_holding_days=4,  # Exit after 4 bars
        min_history=1,
        slippage_bps=0.0,
        fx_pct=0.0,
        commission_pct=0.0,
    )
    
    trades = backtest_single_ticker_R(ohlcv, "AMZN", cfg)
    
    assert not trades.empty, "Should have generated a trade"
    assert trades.iloc[0]["exit_type"] == "time", "Exit should be due to time stop"
    assert trades.iloc[0]["holding_days"] == 4, "Should hold for exactly max_holding_days"
    # Exit should be at close price of the 4th bar after entry
    assert trades.iloc[0]["exit"] == 102.0, "Exit price should be close of final bar"
    # Entry at open=101 on day 2 (idx[2]), exit on day 6 (idx[6]) = 4 bars later
    assert trades.iloc[0]["entry_date"] == idx[2], "Entry should be on day 2"
    assert trades.iloc[0]["exit_date"] == idx[6], "Exit should be on day 6 (4 bars later)"
