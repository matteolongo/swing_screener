from datetime import date, timedelta

from swing_screener.intelligence.evidence import discovery
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.rss import FeedEntry

CFG = EvidenceConfig()


def _entry():
    return [FeedEntry(title="PR", url="http://ir/x", published_at="2026-06-20", summary="s")]


def _info(ticker):
    return {"website": "https://acme.example", "irWebsite": "https://acme.example/investors"}


def test_discovers_advertised_link():
    html = '<html><head><link rel="alternate" type="application/rss+xml" href="/press.rss"></head></html>'
    feeds = {"https://acme.example/press.rss": _entry()}
    url = discovery.discover_ir_feed(
        "ACME", cfg=CFG,
        info_provider=_info,
        fetch_html=lambda u: html,
        fetch_feed_entries=lambda u: feeds.get(u, []),
    )
    assert url == "https://acme.example/press.rss"


def test_falls_back_to_path_probe():
    feeds = {"https://acme.example/feed": _entry()}  # advertised none; /feed validates
    url = discovery.discover_ir_feed(
        "ACME", cfg=CFG,
        info_provider=_info,
        fetch_html=lambda u: "<html><head></head></html>",
        fetch_feed_entries=lambda u: feeds.get(u, []),
    )
    assert url == "https://acme.example/feed"


def test_returns_none_when_nothing_validates():
    url = discovery.discover_ir_feed(
        "ACME", cfg=CFG,
        info_provider=_info,
        fetch_html=lambda u: "<html></html>",
        fetch_feed_entries=lambda u: [],
    )
    assert url is None


def test_returns_none_when_no_site():
    url = discovery.discover_ir_feed(
        "ACME", cfg=CFG,
        info_provider=lambda t: {},
        fetch_html=lambda u: "x",
        fetch_feed_entries=lambda u: _entry(),
    )
    assert url is None


def test_cache_hit_skips_discovery(tmp_path):
    cache = tmp_path / "c.json"
    cache.write_text('{"ACME": {"feed_url": "https://acme.example/cached.rss", "status": "found", "checked_at": "%s"}}'
                     % date(2026, 6, 25).isoformat())
    called = {"n": 0}

    def info(t):
        called["n"] += 1
        return _info(t)

    url = discovery.cached_discover("ACME", cfg=CFG, cache_path=cache, asof_date=date(2026, 6, 25), info_provider=info)
    assert url == "https://acme.example/cached.rss"
    assert called["n"] == 0  # served from fresh cache, no discovery


def test_negative_cache_within_ttl_returns_none(tmp_path):
    cache = tmp_path / "c.json"
    cache.write_text('{"ACME": {"feed_url": null, "status": "none", "checked_at": "%s"}}'
                     % date(2026, 6, 24).isoformat())
    called = {"n": 0}

    def info(t):
        called["n"] += 1
        return _info(t)

    url = discovery.cached_discover("ACME", cfg=CFG, cache_path=cache, asof_date=date(2026, 6, 25), info_provider=info)
    assert url is None
    assert called["n"] == 0  # negative TTL (7d) not expired


def test_stale_cache_rediscovers_and_writes(tmp_path):
    cache = tmp_path / "c.json"
    stale = (date(2026, 6, 25) - timedelta(days=40)).isoformat()
    cache.write_text('{"ACME": {"feed_url": "https://old", "status": "found", "checked_at": "%s"}}' % stale)
    feeds = {"https://acme.example/press.rss": _entry()}
    html = '<html><head><link rel="alternate" type="application/rss+xml" href="/press.rss"></head></html>'
    url = discovery.cached_discover(
        "ACME", cfg=CFG, cache_path=cache, asof_date=date(2026, 6, 25),
        info_provider=_info, fetch_html=lambda u: html, fetch_feed_entries=lambda u: feeds.get(u, []),
    )
    assert url == "https://acme.example/press.rss"
    import json
    assert json.loads(cache.read_text())["ACME"]["checked_at"] == date(2026, 6, 25).isoformat()
