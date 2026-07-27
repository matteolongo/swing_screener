from datetime import date

from swing_screener.intelligence.evidence.collect import collect_evidence
from swing_screener.intelligence.evidence.collectors.polygon_news import (
    PolygonNewsCollector,
)
from swing_screener.intelligence.evidence.collectors.sec_edgar import (
    SecEdgarCatalystCollector,
)
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.data import source_health

CFG = EvidenceConfig(enabled_sources=("sec_edgar_catalysts",))
ASOF = date(2026, 6, 24)


def _ev():
    return SourceEvidence(title="t", url="u", publisher="SEC EDGAR", published_at="2026-06-20",
                          quote_or_summary="s", relevance="r")


def test_collect_caches_and_rereads(tmp_path, monkeypatch):
    calls = {"n": 0}

    def fake_collect(ticker, *, asof_date, cfg, **kw):
        calls["n"] += 1
        return [_ev()]

    monkeypatch.setattr(SecEdgarCatalystCollector, "collect", classmethod(lambda cls, *a, **k: fake_collect(*a, **k)))
    out1 = collect_evidence("AAPL", asof_date=ASOF, cfg=CFG, cache_root=tmp_path)
    out2 = collect_evidence("AAPL", asof_date=ASOF, cfg=CFG, cache_root=tmp_path)
    assert len(out1) == 1 and len(out2) == 1
    assert calls["n"] == 1  # second call served from cache


def test_polygon_news_collector_registered():
    from swing_screener.intelligence.evidence import registry

    assert registry.get_registered().get("polygon_news") is PolygonNewsCollector


def test_polygon_news_runs_when_enabled(tmp_path, monkeypatch):
    cfg = EvidenceConfig(enabled_sources=("polygon_news",))

    def fake_collect(cls, ticker, *, asof_date, cfg, **kw):
        return [
            SourceEvidence(
                title="news",
                url="https://x/y",
                publisher="Polygon",
                published_at="2026-06-23",
                quote_or_summary="s",
                relevance="Polygon news · bullish",
            )
        ]

    monkeypatch.setattr(
        PolygonNewsCollector, "collect", classmethod(fake_collect)
    )
    out = collect_evidence("AAPL", asof_date=ASOF, cfg=cfg, cache_root=tmp_path)
    assert len(out) == 1
    assert out[0].publisher == "Polygon"


def test_failing_collector_records_fallback_and_degrades(tmp_path, monkeypatch):
    source_health.reset_fallback_events()

    def boom(cls, *a, **k):
        raise RuntimeError("feed down")

    monkeypatch.setattr(SecEdgarCatalystCollector, "collect", classmethod(boom))
    out = collect_evidence("AAPL", asof_date=ASOF, cfg=CFG, cache_root=tmp_path)
    assert out == []
    events = source_health.recent_events()
    assert any(e.from_provider == "sec_edgar_catalysts" and e.domain == "intelligence" for e in events)


def test_refresh_reports_each_collector_without_exposing_exceptions(tmp_path, monkeypatch):
    attempts = []

    def boom(cls, *args, **kwargs):
        raise RuntimeError("api_key=top-secret")

    monkeypatch.setattr(SecEdgarCatalystCollector, "collect", classmethod(boom))

    result = collect_evidence(
        "AAPL",
        asof_date=ASOF,
        cfg=CFG,
        cache_root=tmp_path,
        refresh_sources=True,
        attempt_callback=lambda provider, status, count: attempts.append(
            (provider, status, count)
        ),
    )

    assert result == []
    assert attempts == [("sec_edgar_catalysts", "failed", 0)]
    assert "secret" not in repr(attempts)
