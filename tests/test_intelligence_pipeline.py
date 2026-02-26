from datetime import datetime
from types import SimpleNamespace

import pandas as pd

from swing_screener.intelligence.config import IntelligenceConfig, LLMConfig
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


def test_run_intelligence_pipeline_enriches_event_credibility_with_llm(tmp_path, monkeypatch):
    symbols = ["AAPL"]
    events = [
        Event(
            event_id="evt-aapl",
            symbol="AAPL",
            source="yahoo_finance",
            occurred_at="2026-02-02T00:00:00",
            headline="AAPL reports strong quarterly earnings",
            event_type="news",
            credibility=0.65,
        )
    ]
    monkeypatch.setattr(
        "swing_screener.intelligence.pipeline.collect_events",
        lambda **kwargs: events,
    )

    class FakeClassifier:
        def classify(self, **kwargs):
            classification = SimpleNamespace(
                event_type=SimpleNamespace(value="EARNINGS"),
                severity=SimpleNamespace(value="HIGH"),
                primary_symbol="AAPL",
                secondary_symbols=[],
                is_material=True,
                confidence=0.95,
                summary="Apple reported earnings above expectations.",
            )
            return SimpleNamespace(classification=classification, cached=False, model_name="mock-classifier")

    storage = IntelligenceStorage(tmp_path / "intel")
    snapshot = run_intelligence_pipeline(
        symbols=symbols,
        cfg=IntelligenceConfig(enabled=True, llm=LLMConfig(enabled=True, provider="mock")),
        technical_readiness={"AAPL": 0.8},
        asof_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        storage=storage,
        ohlcv=_ohlcv(symbols),
        llm_classifier=FakeClassifier(),
    )

    assert len(snapshot.events) == 1
    enriched = snapshot.events[0]
    assert enriched.event_type == "earnings"
    assert enriched.credibility > 0.65
    assert enriched.metadata.get("llm_event_type") == "EARNINGS"
    assert enriched.metadata.get("llm_severity") == "HIGH"


def test_run_intelligence_pipeline_records_llm_error_details(tmp_path, monkeypatch):
    symbols = ["AAPL"]
    events = [
        Event(
            event_id="evt-aapl",
            symbol="AAPL",
            source="yahoo_finance",
            occurred_at="2026-02-02T00:00:00",
            headline="AAPL issues strategic update",
            event_type="news",
            credibility=0.65,
        )
    ]
    monkeypatch.setattr(
        "swing_screener.intelligence.pipeline.collect_events",
        lambda **kwargs: events,
    )

    class FailingClassifier:
        def classify(self, **kwargs):
            raise ValueError(
                "LLM returned invalid JSON: Expecting value: line 1 column 1 (char 0). "
                "content_type=str content_length=0 finish_reason=stop content_preview=<empty>"
            )

    storage = IntelligenceStorage(tmp_path / "intel")
    snapshot = run_intelligence_pipeline(
        symbols=symbols,
        cfg=IntelligenceConfig(enabled=True, llm=LLMConfig(enabled=True, provider="mock")),
        technical_readiness={"AAPL": 0.8},
        asof_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        storage=storage,
        ohlcv=_ohlcv(symbols),
        llm_classifier=FailingClassifier(),
    )

    assert len(snapshot.events) == 1
    enriched = snapshot.events[0]
    assert enriched.metadata.get("llm_error_type") == "ValueError"
    assert "LLM returned invalid JSON" in str(enriched.metadata.get("llm_error", ""))
