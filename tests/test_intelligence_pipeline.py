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
    assert isinstance(snapshot.evidence_records, list)
    assert isinstance(snapshot.normalized_events, list)
    assert isinstance(snapshot.source_health, dict)
    assert storage.events_path("2026-02-15").exists()
    assert storage.evidence_path("2026-02-15").exists()
    assert storage.normalized_events_path("2026-02-15").exists()
    assert storage.signals_path("2026-02-15").exists()
    assert storage.themes_path("2026-02-15").exists()
    assert storage.opportunities_path("2026-02-15").exists()
    assert storage.symbol_state_path.exists()
    assert storage.source_health_path.exists()


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


def test_run_intelligence_pipeline_applies_event_quality_filters(tmp_path, monkeypatch):
    symbols = ["AAPL"]
    events = [
        Event(
            event_id="evt-aapl-1",
            symbol="AAPL",
            source="yahoo_finance",
            occurred_at="2026-02-02T00:00:00",
            headline="AAPL beats earnings expectations",
            event_type="news",
            credibility=0.8,
            url="https://news.example.com/aapl-earnings",
        ),
        Event(
            event_id="evt-aapl-dup",
            symbol="AAPL",
            source="yahoo_finance",
            occurred_at="2026-02-02T00:01:00",
            headline="AAPL beats earnings expectations",
            event_type="news",
            credibility=0.7,
            url="https://news.example.com/aapl-earnings",
        ),
        Event(
            event_id="evt-aapl-irrelevant",
            symbol="AAPL",
            source="yahoo_finance",
            occurred_at="2026-02-02T00:02:00",
            headline="Global macro discussion without ticker mention",
            event_type="news",
            credibility=0.9,
        ),
    ]
    monkeypatch.setattr(
        "swing_screener.intelligence.pipeline.collect_events",
        lambda **kwargs: events,
    )

    storage = IntelligenceStorage(tmp_path / "intel")
    snapshot = run_intelligence_pipeline(
        symbols=symbols,
        cfg=IntelligenceConfig(enabled=True),
        technical_readiness={"AAPL": 0.8},
        asof_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        storage=storage,
        ohlcv=_ohlcv(symbols),
    )

    assert snapshot.events_kept_count == 1
    assert snapshot.duplicate_suppressed_count == 1
    assert snapshot.events_dropped_count == 2
    assert len(snapshot.events) == 1
    assert snapshot.events[0].event_id == "evt-aapl-1"


def test_run_intelligence_pipeline_skips_llm_for_events_dropped_by_prefilter(tmp_path, monkeypatch):
    symbols = ["AAPL"]
    events = [
        Event(
            event_id="evt-irrelevant",
            symbol="AAPL",
            source="yahoo_finance",
            occurred_at="2026-02-02T00:00:00",
            headline="Global markets digest without ticker mention",
            event_type="news",
            credibility=0.9,
        )
    ]
    monkeypatch.setattr(
        "swing_screener.intelligence.pipeline.collect_events",
        lambda **kwargs: events,
    )

    class CountingClassifier:
        def __init__(self):
            self.calls = 0

        def classify(self, **kwargs):
            self.calls += 1
            classification = SimpleNamespace(
                event_type=SimpleNamespace(value="NEWS"),
                severity=SimpleNamespace(value="LOW"),
                primary_symbol="AAPL",
                secondary_symbols=[],
                is_material=False,
                confidence=0.51,
                summary="Fallback",
            )
            return SimpleNamespace(classification=classification, cached=False, model_name="mock-classifier")

    classifier = CountingClassifier()
    storage = IntelligenceStorage(tmp_path / "intel")
    snapshot = run_intelligence_pipeline(
        symbols=symbols,
        cfg=IntelligenceConfig(enabled=True, llm=LLMConfig(enabled=True, provider="mock")),
        technical_readiness={"AAPL": 0.8},
        asof_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        storage=storage,
        ohlcv=_ohlcv(symbols),
        llm_classifier=classifier,
    )

    assert classifier.calls == 0
    assert snapshot.events == []
    assert snapshot.events_dropped_count == 1
