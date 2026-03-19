from __future__ import annotations

import json
from datetime import datetime
from types import SimpleNamespace

import httpx

from swing_screener.intelligence.config import ScrapePolicyConfig, SourcesConfig
from swing_screener.intelligence.evidence import (
    CalendarFallbackScrapeEvidenceAdapter,
    ExchangeAnnouncementsEvidenceAdapter,
    FinancialNewsRssEvidenceAdapter,
    collect_additional_evidence,
    normalize_evidence_records_with_diagnostics,
    resolve_instrument_profiles,
)
from swing_screener.intelligence.models import EvidenceRecord


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
            scrape_policy=ScrapePolicyConfig(
                require_robots_allow=False,
                deny_if_robots_unreachable=False,
                require_tos_allow_flag=False,
            ),
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
            scrape_policy=ScrapePolicyConfig(
                require_robots_allow=False,
                deny_if_robots_unreachable=False,
                require_tos_allow_flag=False,
            ),
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
        lambda self, **kwargs: (
            setattr(self, "_feeds_path", feed_path)
            or setattr(self, "_timeout_sec", 12.0)
            or setattr(
                self,
                "_discovery",
                kwargs.get("discovery")
                or SimpleNamespace(catalog_news_feeds=lambda **_kwargs: []),
            )
        ),
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


def test_resolve_instrument_profiles_prefers_override_over_master(tmp_path, monkeypatch):
    master_path = tmp_path / "instrument_master.json"
    override_path = tmp_path / "instrument_profiles_overrides.json"
    master_path.write_text(
        json.dumps(
            [
                {
                    "symbol": "AIR.PA",
                    "exchange_mic": "XPAR",
                    "country_code": "FR",
                    "currency": "EUR",
                    "timezone": "Europe/Paris",
                }
            ]
        ),
        encoding="utf-8",
    )
    override_path.write_text(
        json.dumps(
            {
                "AIR.PA": {
                    "symbol": "AIR.PA",
                    "exchange_mic": "XPAR",
                    "country_code": "FR",
                    "currency": "EUR",
                    "timezone": "Europe/Paris",
                    "provider_symbol_map": {"yahoo_finance": "AIR.PA"},
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("swing_screener.intelligence.evidence._INSTRUMENT_MASTER_PATH", master_path)
    monkeypatch.setattr("swing_screener.intelligence.evidence._INSTRUMENT_OVERRIDE_PATH", override_path)
    profiles = resolve_instrument_profiles(["AIR.PA"])
    assert profiles["AIR.PA"].resolution_source == "override"
    assert profiles["AIR.PA"].resolution_confidence == 1.0


def test_resolve_instrument_profiles_uses_openfigi_for_missing_suffix_symbol(tmp_path, monkeypatch):
    master_path = tmp_path / "instrument_master.json"
    override_path = tmp_path / "instrument_profiles_overrides.json"
    cache_path = tmp_path / "openfigi_cache.json"
    master_path.write_text("[]", encoding="utf-8")
    override_path.write_text("{}", encoding="utf-8")

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def post(self, url, json):
            assert url.endswith("/v3/mapping")
            assert json == [
                {
                    "idType": "TICKER",
                    "idValue": "ADS",
                    "marketSecDes": "Equity",
                    "micCode": "XETR",
                    "currency": "EUR",
                }
            ]
            return httpx.Response(
                200,
                json=[
                    {
                        "data": [
                            {
                                "ticker": "ADS",
                                "name": "adidas AG",
                                "figi": "BBG000TEST01",
                                "compositeFIGI": "BBG000TEST02",
                                "shareClassFIGI": "BBG000TEST03",
                                "securityType": "Common Stock",
                                "marketSector": "Equity",
                            }
                        ]
                    }
                ],
                request=httpx.Request("POST", url),
            )

    monkeypatch.setenv("SWING_SCREENER_OPENFIGI_ENABLED", "true")
    monkeypatch.setattr("swing_screener.intelligence.evidence.httpx.Client", _Client)
    monkeypatch.setattr("swing_screener.intelligence.evidence._INSTRUMENT_MASTER_PATH", master_path)
    monkeypatch.setattr("swing_screener.intelligence.evidence._INSTRUMENT_OVERRIDE_PATH", override_path)
    monkeypatch.setattr("swing_screener.intelligence.evidence._OPENFIGI_CACHE_PATH", cache_path)

    profiles = resolve_instrument_profiles(["ADS.DE"])

    assert profiles["ADS.DE"].resolution_source == "openfigi"
    assert profiles["ADS.DE"].exchange_mic == "XETR"
    assert profiles["ADS.DE"].country_code == "DE"
    assert profiles["ADS.DE"].currency == "EUR"
    assert profiles["ADS.DE"].provider_symbol_map["stooq"] == "ads.de"
    assert profiles["ADS.DE"].name == "adidas AG"
    assert profiles["ADS.DE"].figi == "BBG000TEST01"


def test_normalize_evidence_records_fuzzy_dedupe_and_dynamic_quality():
    records = [
        EvidenceRecord(
            evidence_id="a1",
            symbol="AAPL",
            source_name="yahoo_finance",
            source_type="news",
            url="https://example.com/aapl/earnings",
            headline="AAPL beats earnings expectations",
            body_snippet="",
            published_at="2026-02-10T10:00:00",
            event_at="2026-02-10T10:00:00",
            feed_origin="manual",
        ),
        EvidenceRecord(
            evidence_id="a2",
            symbol="AAPL",
            source_name="financial_news_rss",
            source_type="news",
            url="https://news.example.com/apple-earnings",
            headline="AAPL beats earnings expectation",
            body_snippet="",
            published_at="2026-02-10T11:00:00",
            event_at="2026-02-10T11:00:00",
            feed_origin="catalog",
        ),
    ]
    normalized, diag = normalize_evidence_records_with_diagnostics(
        records,
        asof_dt=datetime.fromisoformat("2026-02-11T00:00:00"),
        historical_precision_by_source={"yahoo_finance": 0.62, "financial_news_rss": 0.58},
    )
    assert len(normalized) == 1
    assert diag.pre_dedupe_count == 2
    assert diag.post_dedupe_count == 1
    assert normalized[0].dedupe_method in {"title_fuzzy", "hybrid"}
    assert 0.0 <= normalized[0].dynamic_source_quality <= 1.0
