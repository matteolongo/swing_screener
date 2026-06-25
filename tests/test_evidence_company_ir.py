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
    out = CompanyIrRssCollector.collect(
        "ZZZZ", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch, feeds_path=feeds, discover=lambda t: None
    )
    assert out == []


def test_discovery_used_on_seed_miss(tmp_path):
    feeds = tmp_path / "ir_feeds.json"
    feeds.write_text('{"AAPL": ["http://ir/feed"]}')
    calls = {"discover": []}

    def discover(t):
        calls["discover"].append(t)
        return "http://discovered/feed"

    out = CompanyIrRssCollector.collect(
        "TSLA", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch, feeds_path=feeds, discover=discover
    )
    assert calls["discover"] == ["TSLA"]
    assert len(out) == 1
    assert out[0].publisher == "Company IR"


def test_seed_overrides_discovery(tmp_path):
    feeds = tmp_path / "ir_feeds.json"
    feeds.write_text('{"AAPL": ["http://ir/feed"]}')
    calls = {"discover": 0}

    def discover(t):
        calls["discover"] += 1
        return "http://discovered/feed"

    out = CompanyIrRssCollector.collect(
        "AAPL", asof_date=date(2026, 6, 24), cfg=CFG, fetch=_fake_fetch, feeds_path=feeds, discover=discover
    )
    assert calls["discover"] == 0  # seed present -> no discovery
    assert len(out) == 1


def test_discovery_disabled_is_seed_only(tmp_path):
    feeds = tmp_path / "ir_feeds.json"
    feeds.write_text('{"AAPL": ["http://ir/feed"]}')
    cfg = EvidenceConfig(discovery_enabled=False)
    calls = {"discover": 0}

    def discover(t):
        calls["discover"] += 1
        return "http://discovered/feed"

    out = CompanyIrRssCollector.collect(
        "TSLA", asof_date=date(2026, 6, 24), cfg=cfg, fetch=_fake_fetch, feeds_path=feeds, discover=discover
    )
    assert calls["discover"] == 0
    assert out == []


def test_describe_shape():
    d = CompanyIrRssCollector.describe()
    assert d.id == "company_ir_rss"
    assert d.canary_market == "us"
    assert d.domain == "intelligence"
