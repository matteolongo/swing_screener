from datetime import date

from swing_screener.intelligence.evidence.collectors.exchange import ExchangeAnnouncementsCollector
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.rss import FeedEntry

CFG = EvidenceConfig()


def _fake_fetch(url):
    return [FeedEntry(title="Euronext notice", url="http://ex/1", published_at="2026-06-20", summary="halt")]


def test_us_mic_skipped(tmp_path):
    catalog = tmp_path / "source_catalog.json"
    catalog.write_text('{"exchange": {"XNAS": ["http://x"]}}')
    out = ExchangeAnnouncementsCollector.collect(
        "AAPL", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch,
        mic_resolver=lambda t: "XNAS", catalog_path=catalog,
    )
    assert out == []


def test_eu_mic_collects(tmp_path):
    catalog = tmp_path / "source_catalog.json"
    catalog.write_text('{"exchange": {"XAMS": ["http://euronext/feed"]}}')
    out = ExchangeAnnouncementsCollector.collect(
        "ASML.AS", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch,
        mic_resolver=lambda t: "XAMS", catalog_path=catalog,
    )
    assert len(out) == 1
    assert out[0].relevance == "exchange notice"
    assert out[0].publisher == "Exchange XAMS"


def test_unresolved_mic_returns_empty(tmp_path):
    catalog = tmp_path / "source_catalog.json"
    catalog.write_text('{"exchange": {"XAMS": ["http://x"]}}')
    out = ExchangeAnnouncementsCollector.collect(
        "WAT.XX", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch,
        mic_resolver=lambda t: None, catalog_path=catalog,
    )
    assert out == []
