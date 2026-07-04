from __future__ import annotations

from datetime import date

from swing_screener.intelligence.evidence.collect import collect_evidence
from swing_screener.intelligence.evidence.collectors.tavily_news import TavilyNewsCollector
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.models import SourceEvidence


ASOF = date(2026, 7, 3)


def test_maps_tavily_results_to_source_evidence(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "test-key")

    def fake_search(query, *, cfg, api_key):
        assert api_key == "test-key"
        assert "AAPL" in query
        return {
            "results": [
                {
                    "title": "Apple shares rise on services demand",
                    "url": "https://example.com/apple-services",
                    "content": "Services demand improved and analysts raised estimates.",
                    "published_date": "2026-07-03",
                    "source": "Example Wire",
                }
            ]
        }

    out = TavilyNewsCollector.collect("aapl", asof_date=ASOF, cfg=EvidenceConfig(), search_fn=fake_search)

    assert len(out) == 1
    assert out[0].title == "Apple shares rise on services demand"
    assert out[0].url == "https://example.com/apple-services"
    assert out[0].publisher == "Example Wire"
    assert out[0].published_at == "2026-07-03"
    assert "Tavily news" in out[0].relevance


def test_returns_empty_without_tavily_key(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    out = TavilyNewsCollector.collect("AAPL", asof_date=ASOF, cfg=EvidenceConfig())

    assert out == []


def test_tavily_registered_but_refresh_only():
    from swing_screener.intelligence.evidence.registry import get_registered

    assert get_registered().get("tavily_news") is TavilyNewsCollector
    assert TavilyNewsCollector.REFRESH_ONLY is True


def test_collect_evidence_skips_tavily_without_refresh(tmp_path, monkeypatch):
    cfg = EvidenceConfig(enabled_sources=("tavily_news",))
    calls = {"n": 0}

    def fake_collect(cls, ticker, *, asof_date, cfg, **kwargs):
        calls["n"] += 1
        return [
            SourceEvidence(
                title="t",
                url="https://example.com/t",
                publisher="Tavily",
                published_at="2026-07-03",
                quote_or_summary="s",
                relevance="Tavily news",
            )
        ]

    monkeypatch.setattr(TavilyNewsCollector, "collect", classmethod(fake_collect))

    out = collect_evidence("AAPL", asof_date=ASOF, cfg=cfg, cache_root=tmp_path, refresh_sources=False)

    assert out == []
    assert calls["n"] == 0


def test_collect_evidence_runs_tavily_on_refresh(tmp_path, monkeypatch):
    cfg = EvidenceConfig(enabled_sources=("tavily_news",))

    def fake_collect(cls, ticker, *, asof_date, cfg, **kwargs):
        return [
            SourceEvidence(
                title="refresh item",
                url="https://example.com/refresh",
                publisher="Tavily",
                published_at="2026-07-03",
                quote_or_summary="Fresh source",
                relevance="Tavily news",
            )
        ]

    monkeypatch.setattr(TavilyNewsCollector, "collect", classmethod(fake_collect))

    out = collect_evidence("AAPL", asof_date=ASOF, cfg=cfg, cache_root=tmp_path, refresh_sources=True)

    assert len(out) == 1
    assert out[0].publisher == "Tavily"
