from datetime import datetime

import pandas as pd

from swing_screener.intelligence.config import IntelligenceConfig
from swing_screener.intelligence.models import Event
from swing_screener.intelligence.pipeline import run_intelligence_pipeline
from swing_screener.intelligence.storage import IntelligenceStorage


def _ohlcv(symbols: list[str]) -> pd.DataFrame:
    index = pd.bdate_range("2026-01-05", periods=35)
    data = {}
    for symbol in symbols:
        close = pd.Series([100 + i * 0.2 for i in range(len(index))], index=index, dtype=float)
        close.iloc[20] = close.iloc[19] * 1.08
        open_ = close.shift(1).fillna(close)
        high = close * 1.01
        low = close * 0.99
        volume = pd.Series(1_000_000, index=index, dtype=float)
        data[("Open", symbol)] = open_
        data[("High", symbol)] = high
        data[("Low", symbol)] = low
        data[("Close", symbol)] = close
        data[("Volume", symbol)] = volume
    frame = pd.DataFrame(data, index=index)
    frame.columns = pd.MultiIndex.from_tuples(frame.columns)
    return frame


def test_run_intelligence_pipeline_persists_outputs(tmp_path, monkeypatch):
    symbols = ["AAPL", "MSFT", "NVDA"]
    events = [
        Event(
            event_id=f"evt-{symbol}",
            symbol=symbol,
            source="yahoo_finance",
            occurred_at="2026-02-02T00:00:00",
            headline=f"{symbol} catalyst",
            event_type="news",
            credibility=0.8,
        )
        for symbol in symbols
    ]
    monkeypatch.setattr(
        "swing_screener.intelligence.pipeline.collect_events",
        lambda **kwargs: events,
    )

    storage = IntelligenceStorage(tmp_path / "intel")
    snapshot = run_intelligence_pipeline(
        symbols=symbols,
        cfg=IntelligenceConfig(enabled=True),
        technical_readiness={symbol: 0.8 for symbol in symbols},
        asof_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        storage=storage,
        ohlcv=_ohlcv(symbols),
        peer_map={"AAPL": ("MSFT", "NVDA"), "MSFT": ("AAPL", "NVDA"), "NVDA": ("AAPL", "MSFT")},
    )

    assert snapshot.asof_date == "2026-02-15"
    assert len(snapshot.events) == 3
    assert len(snapshot.signals) == 3
    assert len(snapshot.opportunities) > 0
    assert storage.events_path("2026-02-15").exists()
    assert storage.signals_path("2026-02-15").exists()
    assert storage.themes_path("2026-02-15").exists()
    assert storage.opportunities_path("2026-02-15").exists()
    assert storage.symbol_state_path.exists()


def test_run_intelligence_pipeline_handles_empty_symbols(tmp_path):
    storage = IntelligenceStorage(tmp_path / "intel")
    snapshot = run_intelligence_pipeline(
        symbols=[],
        cfg=IntelligenceConfig(enabled=True),
        asof_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        storage=storage,
    )

    assert snapshot.symbols == tuple()
    assert snapshot.events == []
    assert snapshot.signals == []
    assert snapshot.opportunities == []

