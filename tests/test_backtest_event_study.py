"""Event-study backtest: replay live signal/stop/exit logic over history."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from swing_screener.backtest import event_study as event_study_mod
from swing_screener.backtest.config import BacktestConfig
from swing_screener.backtest.event_study import run_event_study
from swing_screener.backtest.ledger import Trade
from swing_screener.backtest.metrics import compute_metrics
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.execution.guidance import ExecutionConfig
from swing_screener.portfolio.state import ManageConfig


def _ohlcv(ticker: str, opens, highs, lows, closes, volumes=None) -> pd.DataFrame:
    n = len(closes)
    idx = pd.date_range("2022-01-03", periods=n, freq="B")
    if volumes is None:
        volumes = [1_000_000] * n
    cols = pd.MultiIndex.from_tuples(
        [
            ("Open", ticker),
            ("High", ticker),
            ("Low", ticker),
            ("Close", ticker),
            ("Volume", ticker),
        ]
    )
    data = np.column_stack([opens, highs, lows, closes, volumes])
    return pd.DataFrame(data, index=idx, columns=cols)


def _fast_config(*, pattern_stop_enabled: bool = False) -> BacktestConfig:
    """Small lookbacks so synthetic fixtures stay short; deterministic stops."""
    return BacktestConfig(
        entry=EntrySignalConfig(breakout_lookback=5, pullback_ma=5, min_history=15),
        execution=ExecutionConfig(
            pattern_stop_enabled=pattern_stop_enabled, pattern_stop_atr_buffer=0.25
        ),
        manage=ManageConfig(
            breakeven_at_R=1.0,
            trail_after_R=2.0,
            trail_sma=5,
            max_holding_days=20,
            exit_signal_days=0,
        ),
        k_atr=2.0,
        rr_target=2.0,
        atr_window=14,
    )


def _flat_base_then_breakout_then_collapse():
    """20 flat bars (close 100, TR 2), one breakout bar (close 110), then a deep
    collapse the following bar that gaps well below any ATR stop."""
    closes = [100.0] * 20 + [110.0, 90.0]
    opens = [100.0] * 20 + [110.0, 110.0]
    highs = [101.0] * 20 + [111.0, 111.0]
    lows = [99.0] * 20 + [99.0, 89.0]
    return opens, highs, lows, closes


def test_stop_hit_trade_realizes_exactly_minus_one_r():
    opens, highs, lows, closes = _flat_base_then_breakout_then_collapse()
    ohlcv = _ohlcv("TEST", opens, highs, lows, closes)

    result = run_event_study(ohlcv, ["TEST"], _fast_config())

    assert len(result.trades) == 1
    trade = result.trades[0]
    assert trade.setup == "breakout"
    # Signal fires on bar 20 (the breakout close); fill is the next bar's open.
    assert trade.entry_price == 110.0
    assert trade.exit_reason == "stop_hit"
    # Exiting at the stop is, by definition, a loss of exactly 1R.
    assert trade.exit_price == pytest.approx(trade.initial_stop)
    assert trade.r_multiple == pytest.approx(-1.0)
    assert trade.initial_risk > 0
    assert trade.bars_held == 1


def test_result_carries_metrics_for_its_trades():
    opens, highs, lows, closes = _flat_base_then_breakout_then_collapse()
    ohlcv = _ohlcv("TEST", opens, highs, lows, closes)

    result = run_event_study(ohlcv, ["TEST"], _fast_config())

    assert result.metrics.n_trades == len(result.trades) == 1
    assert result.metrics.expectancy_r == pytest.approx(result.trades[0].r_multiple)


def test_no_signal_yields_no_trades():
    n = 30
    flat = [100.0] * n
    ohlcv = _ohlcv("TEST", flat, [101.0] * n, [99.0] * n, flat)

    result = run_event_study(ohlcv, ["TEST"], _fast_config())

    assert result.trades == []


def test_winner_time_exit_has_positive_r_and_breakeven_protected():
    # Flat base, breakout, then a steady climb that never retraces to the stop.
    base = [100.0] * 20
    # 21 rising bars: data ends exactly on the 20th-day time-exit bar, so the
    # closed trade leaves no room for a second signal.
    climb = [110.0 + 2.0 * k for k in range(21)]
    closes = base + climb
    opens = base + climb
    highs = [c + 1.0 for c in closes]
    lows = [c - 1.0 for c in closes]
    ohlcv = _ohlcv("TEST", opens, highs, lows, closes)

    result = run_event_study(ohlcv, ["TEST"], _fast_config())

    assert len(result.trades) == 1
    trade = result.trades[0]
    assert trade.exit_reason == "time_exit"
    assert trade.r_multiple > 0
    assert trade.mfe_r >= trade.r_multiple
    # max_holding_days=20 -> exit on the 20th bar held
    assert trade.bars_held == 20


def test_pattern_stop_flag_tightens_initial_risk(monkeypatch):
    opens, highs, lows, closes = _flat_base_then_breakout_then_collapse()
    ohlcv = _ohlcv("TEST", opens, highs, lows, closes)

    baseline = run_event_study(
        ohlcv, ["TEST"], _fast_config(pattern_stop_enabled=False)
    )
    baseline_stop = baseline.trades[0].initial_stop

    # Force a tighter structural stop just above the ATR stop to isolate the wiring.
    tighter = baseline_stop + 1.0

    def _fake_pattern_stop(**kwargs):
        return tighter, "forced pattern stop"

    monkeypatch.setattr(event_study_mod, "apply_pattern_stop", _fake_pattern_stop)

    patterned = run_event_study(
        ohlcv, ["TEST"], _fast_config(pattern_stop_enabled=True)
    )
    trade = patterned.trades[0]

    assert trade.pattern_stop_fired is True
    assert trade.initial_stop == pytest.approx(tighter)
    assert trade.initial_risk < baseline.trades[0].initial_risk


def test_compute_metrics_summarizes_r_distribution():
    trades = [
        _trade(r=2.0, reason="time_exit", bars=10),
        _trade(r=-1.0, reason="stop_hit", bars=3),
        _trade(r=1.0, reason="exit_signal", bars=6),
    ]

    m = compute_metrics(trades)

    assert m.n_trades == 3
    assert m.win_rate == pytest.approx(2 / 3)
    assert m.expectancy_r == pytest.approx(2 / 3)
    assert m.total_r == pytest.approx(2.0)
    assert m.profit_factor == pytest.approx(3.0)
    assert m.avg_win_r == pytest.approx(1.5)
    assert m.avg_loss_r == pytest.approx(-1.0)
    assert m.avg_bars_held == pytest.approx(19 / 3)
    # equity curve 2 -> 1 -> 2; worst peak-to-trough drop is 1R
    assert m.max_drawdown_r == pytest.approx(1.0)
    assert m.exit_reason_counts == {"time_exit": 1, "stop_hit": 1, "exit_signal": 1}


def test_compute_metrics_empty_is_zeroed():
    m = compute_metrics([])
    assert m.n_trades == 0
    assert m.expectancy_r == 0.0
    assert m.win_rate == 0.0


def _trade(*, r: float, reason: str, bars: int) -> Trade:
    return Trade(
        ticker="TEST",
        setup="breakout",
        entry_date="2022-01-03",
        entry_price=100.0,
        initial_stop=95.0,
        initial_risk=5.0,
        target=110.0,
        exit_date="2022-01-10",
        exit_price=100.0 + r * 5.0,
        exit_reason=reason,
        r_multiple=r,
        bars_held=bars,
        mfe_r=max(r, 0.0),
        mae_r=min(r, 0.0),
        pattern_stop_fired=False,
    )
