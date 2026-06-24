from datetime import date

from swing_screener.intelligence.evidence.collectors.company_ir import CompanyIrRssCollector
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.rss import FeedEntry

CFG = EvidenceConfig()


def _fake_fetch(url):
    return [FeedEntry(title="Apple buyback", url="http://ir/x", published_at="2026-06-20", summary="$90B")]


def test_maps_seed_feed_entries(tmp_path):
    feeds = tmp_path / "ir_feeds.json"
    feeds.write_text('{"AAPL": ["http://ir/feed"]}')
    out = CompanyIrRssCollector.collect("AAPL", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch, feeds_path=feeds)
    assert len(out) == 1
    assert out[0].publisher == "Company IR"
    assert out[0].relevance == "official IR release"
    assert out[0].quote_or_summary == "$90B"


def test_unmapped_ticker_returns_empty(tmp_path):
    feeds = tmp_path / "ir_feeds.json"
    feeds.write_text('{"AAPL": ["http://ir/feed"]}')
    out = CompanyIrRssCollector.collect("ZZZZ", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch, feeds_path=feeds)
    assert out == []


def test_describe_shape():
    d = CompanyIrRssCollector.describe()
    assert d.id == "company_ir_rss"
    assert d.canary_market == "us"
    assert d.domain == "intelligence"
