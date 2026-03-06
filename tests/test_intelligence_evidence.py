from __future__ import annotations

import json
from datetime import datetime

import httpx

from swing_screener.intelligence.config import SourcesConfig
from swing_screener.intelligence.evidence import (
    CalendarFallbackScrapeEvidenceAdapter,
    ExchangeAnnouncementsEvidenceAdapter,
    FinancialNewsRssEvidenceAdapter,
    collect_additional_evidence,
    resolve_instrument_profiles,
)


def test_resolve_instrument_profiles_maps_european_suffixes():
    profiles = resolve_instrument_profiles(["ADS.DE", "AAPL"])
    assert profiles["ADS.DE"].exchange_mic == "XETR"
    assert profiles["ADS.DE"].currency == "EUR"
    assert profiles["AAPL"].exchange_mic == "XNAS"
    assert profiles["AAPL"].currency == "USD"


def test_exchange_announcements_adapter_reads_exchange_feed(tmp_path, monkeypatch):
    feed_path = tmp_path / "exchange_feeds.json"
    feed_path.write_text(
        json.dumps(
            {
                "XPAR": ["https://example.com/xpar.xml"],
            }
        ),
        encoding="utf-8",
    )

    xml = """<?xml version=\"1.0\"?>
    <rss><channel>
      <item>
        <title>AIR.PA guidance update announced</title>
        <link>https://example.com/item1</link>
        <pubDate>Tue, 10 Feb 2026 10:00:00 GMT</pubDate>
        <description>Company announcement</description>
      </item>
    </channel></rss>
    """

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, url):
            assert url == "https://example.com/xpar.xml"
            return httpx.Response(200, text=xml, request=httpx.Request("GET", url))

    monkeypatch.setattr("swing_screener.intelligence.evidence.httpx.Client", _Client)

    adapter = ExchangeAnnouncementsEvidenceAdapter(feeds_path=feed_path)
    profiles = resolve_instrument_profiles(["AIR.PA"])
    records = adapter.fetch_records(
        symbols=["AIR.PA"],
        profiles=profiles,
        start_dt=datetime.fromisoformat("2026-02-01T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        cfg=SourcesConfig(enabled=("exchange_announcements",)),
    )

    assert len(records) == 1
    assert records[0].symbol == "AIR.PA"
    assert records[0].source_name == "exchange_announcements"


def test_financial_news_rss_adapter_maps_symbol_mentions(tmp_path, monkeypatch):
    feed_path = tmp_path / "financial_news_feeds.json"
    feed_path.write_text(json.dumps(["https://example.com/news.xml"]), encoding="utf-8")

    xml = """<?xml version=\"1.0\"?>
    <rss><channel>
      <item>
        <title>MSFT launches enterprise AI upgrade</title>
        <link>https://example.com/news1</link>
        <pubDate>Tue, 10 Feb 2026 12:00:00 GMT</pubDate>
        <description>Major product launch for MSFT cloud stack</description>
      </item>
    </channel></rss>
    """

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, url):
            assert url == "https://example.com/news.xml"
            return httpx.Response(200, text=xml, request=httpx.Request("GET", url))

    monkeypatch.setattr("swing_screener.intelligence.evidence.httpx.Client", _Client)

    adapter = FinancialNewsRssEvidenceAdapter(feeds_path=feed_path)
    profiles = resolve_instrument_profiles(["MSFT", "AAPL"])
    records = adapter.fetch_records(
        symbols=["MSFT", "AAPL"],
        profiles=profiles,
        start_dt=datetime.fromisoformat("2026-02-01T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        cfg=SourcesConfig(enabled=("financial_news_rss",)),
    )

    assert len(records) == 1
    assert records[0].symbol == "MSFT"
    assert records[0].source_name == "financial_news_rss"


def test_calendar_fallback_scrape_respects_whitelist_and_flag(tmp_path, monkeypatch):
    cfg_path = tmp_path / "calendar_fallback_urls.json"
    cfg_path.write_text(json.dumps(["https://calendar.example.com/page"]), encoding="utf-8")

    html = """
    <html><body>
      <table>
        <tr><td>AAPL</td><td>2026-02-20</td></tr>
      </table>
    </body></html>
    """

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, url):
            assert url == "https://calendar.example.com/page"
            return httpx.Response(200, text=html, request=httpx.Request("GET", url))

    monkeypatch.setattr("swing_screener.intelligence.evidence.httpx.Client", _Client)

    adapter = CalendarFallbackScrapeEvidenceAdapter(config_path=cfg_path)

    records_disabled = adapter.fetch_records(
        symbols=["AAPL"],
        profiles=resolve_instrument_profiles(["AAPL"]),
        start_dt=datetime.fromisoformat("2026-02-01T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        cfg=SourcesConfig(
            enabled=("calendar_fallback_scrape",),
            scraping_enabled=False,
            allowed_domains=("calendar.example.com",),
        ),
    )
    assert records_disabled == []

    records_enabled = adapter.fetch_records(
        symbols=["AAPL"],
        profiles=resolve_instrument_profiles(["AAPL"]),
        start_dt=datetime.fromisoformat("2026-02-01T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        cfg=SourcesConfig(
            enabled=("calendar_fallback_scrape",),
            scraping_enabled=True,
            allowed_domains=("calendar.example.com",),
        ),
    )
    assert len(records_enabled) == 1
    assert records_enabled[0].symbol == "AAPL"
    assert records_enabled[0].source_type == "scrape"


def test_collect_additional_evidence_reports_adapter_health_when_enabled(tmp_path, monkeypatch):
    feed_path = tmp_path / "financial_news_feeds.json"
    feed_path.write_text(json.dumps(["https://example.com/news.xml"]), encoding="utf-8")

    xml = """<?xml version=\"1.0\"?>
    <rss><channel>
      <item>
        <title>AAPL investor day announced</title>
        <link>https://example.com/news1</link>
        <pubDate>Tue, 10 Feb 2026 12:00:00 GMT</pubDate>
        <description>AAPL event</description>
      </item>
    </channel></rss>
    """

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, url):
            if url.endswith("news.xml"):
                return httpx.Response(200, text=xml, request=httpx.Request("GET", url))
            return httpx.Response(404, text="", request=httpx.Request("GET", url))

    monkeypatch.setattr("swing_screener.intelligence.evidence.httpx.Client", _Client)
    monkeypatch.setattr(
        "swing_screener.intelligence.evidence.FinancialNewsRssEvidenceAdapter.__init__",
        lambda self, **kwargs: setattr(self, "_feeds_path", feed_path) or setattr(self, "_timeout_sec", 12.0),
    )

    records, health = collect_additional_evidence(
        symbols=["AAPL"],
        profiles=resolve_instrument_profiles(["AAPL"]),
        start_dt=datetime.fromisoformat("2026-02-01T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        cfg=SourcesConfig(enabled=("financial_news_rss",)),
    )

    assert any(record.source_name == "financial_news_rss" for record in records)
    assert "financial_news_rss" in health
    assert health["financial_news_rss"].enabled is True
