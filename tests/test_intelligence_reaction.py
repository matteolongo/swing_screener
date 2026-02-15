from datetime import datetime

import pandas as pd

from swing_screener.intelligence.config import CatalystConfig
from swing_screener.intelligence.models import Event
from swing_screener.intelligence.reaction import (
    build_catalyst_signals,
    evaluate_event_reaction,
)


def _build_ohlcv(symbol: str, *, shock_idx: int | None = None, shock_return: float = 0.08) -> pd.DataFrame:
    index = pd.bdate_range("2026-01-05", periods=30)
    closes = [100.0]
    for i in range(1, len(index)):
        prev = closes[-1]
        if shock_idx is not None and i == shock_idx:
            closes.append(round(prev * (1 + shock_return), 4))
        else:
            closes.append(round(prev * (1 + (0.001 if i % 2 == 0 else -0.0007)), 4))

    highs: list[float] = []
    lows: list[float] = []
    opens: list[float] = []
    volumes: list[int] = []
    for i, close in enumerate(closes):
        prev = closes[i - 1] if i > 0 else close
        opens.append(prev)
        if shock_idx is not None and i == shock_idx:
            highs.append(round(close * 1.055, 4))
            lows.append(round(close * 0.945, 4))
        else:
            highs.append(round(close * 1.01, 4))
            lows.append(round(close * 0.99, 4))
        volumes.append(1_000_000 + i * 1000)

    data = {
        ("Open", symbol): opens,
        ("High", symbol): highs,
        ("Low", symbol): lows,
        ("Close", symbol): closes,
        ("Volume", symbol): volumes,
    }
    return pd.DataFrame(data, index=index)


def test_evaluate_event_reaction_detects_abnormal_move():
    ohlcv = _build_ohlcv("AAPL", shock_idx=15, shock_return=0.09)
    event_time = ohlcv.index[15].isoformat()

    metrics = evaluate_event_reaction(
        ohlcv=ohlcv,
        symbol="AAPL",
        event_time=event_time,
        z_lookback=14,
        atr_window=10,
    )

    assert metrics.valid is True
    assert metrics.event_bar == ohlcv.index[15].isoformat()
    assert metrics.return_z > 1.5
    assert metrics.atr_shock > 1.0


def test_event_on_non_trading_day_maps_to_next_bar():
    ohlcv = _build_ohlcv("AAPL", shock_idx=6, shock_return=0.04)
    weekend_event = datetime.fromisoformat("2026-01-10T10:30:00")  # Saturday

    metrics = evaluate_event_reaction(
        ohlcv=ohlcv,
        symbol="AAPL",
        event_time=weekend_event,
    )

    assert metrics.valid is True
    # Jan 12, 2026 is the next business day in the generated index.
    assert metrics.event_bar == "2026-01-12T00:00:00"


def test_build_catalyst_signals_flags_false_catalyst_small_move():
    ohlcv = _build_ohlcv("AAPL")
    event = Event(
        event_id="evt-small",
        symbol="AAPL",
        source="yahoo_finance",
        occurred_at=ohlcv.index[15].isoformat(),
        headline="Minor update",
        event_type="news",
        credibility=0.6,
    )

    cfg = CatalystConfig(false_catalyst_return_z=1.5, min_price_reaction_atr=0.8)
    signals = build_catalyst_signals(
        events=[event],
        ohlcv=ohlcv,
        cfg=cfg,
        asof_dt=datetime.fromisoformat("2026-02-20T00:00:00"),
    )

    assert len(signals) == 1
    assert signals[0].is_false_catalyst is True
    assert "return_z_below_threshold" in signals[0].reasons


def test_build_catalyst_signals_marks_missing_symbol_data():
    ohlcv = _build_ohlcv("AAPL", shock_idx=15, shock_return=0.09)
    event = Event(
        event_id="evt-msft",
        symbol="MSFT",
        source="yahoo_finance",
        occurred_at="2026-01-26T00:00:00",
        headline="MSFT event",
        event_type="news",
        credibility=0.7,
    )

    signals = build_catalyst_signals(
        events=[event],
        ohlcv=ohlcv,
        cfg=CatalystConfig(),
        asof_dt=datetime.fromisoformat("2026-02-20T00:00:00"),
    )

    assert len(signals) == 1
    assert signals[0].is_false_catalyst is True
    assert "symbol_data_missing" in signals[0].reasons
