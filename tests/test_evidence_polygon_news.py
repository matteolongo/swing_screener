from datetime import date

import pytest

from swing_screener.intelligence.evidence.collectors.polygon_news import (
    PolygonNewsCollector,
)
from swing_screener.intelligence.evidence.config import EvidenceConfig

CFG = EvidenceConfig()

NEWS_PAYLOAD = {
    "results": [
        {
            "id": "a1",
            "title": "Apple unveils new chip",
            "description": "Apple announced a faster M-series chip today.",
            "article_url": "https://news.example.com/apple-chip",
            "author": "Jane Doe",
            "published_utc": "2026-06-25T12:00:00Z",
            "publisher": {"name": "The Example Fool"},
            "tickers": ["AAPL"],
            "insights": [
                {
                    "ticker": "AAPL",
                    "sentiment": "positive",
                    "sentiment_reasoning": "New product seen as a growth driver.",
                }
            ],
        },
        {
            "id": "a2",
            "title": "Regulatory probe widens",
            "description": "Antitrust scrutiny intensifies.",
            "article_url": "https://news.example.com/apple-probe",
            "published_utc": "2026-06-24T09:00:00Z",
            "publisher": {"name": "Example Wire"},
            "tickers": ["AAPL"],
            "insights": [
                {"ticker": "AAPL", "sentiment": "negative", "sentiment_reasoning": "Legal risk."}
            ],
        },
    ],
    "status": "OK",
    "count": 2,
}


def _fake_get_json(url):
    assert "/v2/reference/news" in url
    assert "ticker=AAPL" in url
    return NEWS_PAYLOAD


def test_maps_articles_to_source_evidence():
    out = PolygonNewsCollector.collect(
        "AAPL", asof_date=date(2026, 6, 26), cfg=CFG, get_json=_fake_get_json
    )
    assert len(out) == 2
    first = out[0]
    assert first.title == "Apple unveils new chip"
    assert first.url == "https://news.example.com/apple-chip"
    assert first.publisher == "The Example Fool"
    assert first.published_at == "2026-06-25T12:00:00Z"
    assert first.quote_or_summary == "Apple announced a faster M-series chip today."


def test_sentiment_mapped_into_relevance():
    out = PolygonNewsCollector.collect(
        "AAPL", asof_date=date(2026, 6, 26), cfg=CFG, get_json=_fake_get_json
    )
    assert "bullish" in out[0].relevance
    assert "bearish" in out[1].relevance


def test_skips_articles_without_url():
    payload = {"results": [{"title": "no url", "publisher": {"name": "X"}}]}
    out = PolygonNewsCollector.collect(
        "AAPL", asof_date=date(2026, 6, 26), cfg=CFG, get_json=lambda url: payload
    )
    assert out == []


def test_returns_empty_without_api_key(monkeypatch):
    monkeypatch.delenv("POLYGON_IO_API_KEY", raising=False)
    out = PolygonNewsCollector.collect("AAPL", asof_date=date(2026, 6, 26), cfg=CFG)
    assert out == []


def test_describe_reflects_key_presence(monkeypatch):
    monkeypatch.delenv("POLYGON_IO_API_KEY", raising=False)
    d = PolygonNewsCollector.describe()
    assert d.id == "polygon_news"
    assert d.domain == "intelligence"
    assert d.configured is False
    assert d.requires == "POLYGON_IO_API_KEY"

    monkeypatch.setenv("POLYGON_IO_API_KEY", "k")
    assert PolygonNewsCollector.describe().configured is True


def test_probe_not_configured_without_key(monkeypatch):
    monkeypatch.delenv("POLYGON_IO_API_KEY", raising=False)
    r = PolygonNewsCollector.probe("AAPL")
    assert r.status == "not_configured"
