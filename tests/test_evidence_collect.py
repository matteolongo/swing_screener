import json
from datetime import date

from swing_screener.intelligence.evidence.collect import (
    collect_evidence,
    read_latest_cached_evidence_summary,
)
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


def test_failed_refresh_preserves_existing_cache(tmp_path, monkeypatch):
    cache_file = tmp_path / ASOF.isoformat() / "AAPL.json"
    cache_file.parent.mkdir(parents=True)
    cache_file.write_text(json.dumps([_ev().model_dump()]))

    def boom(cls, *args, **kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(SecEdgarCatalystCollector, "collect", classmethod(boom))

    result = collect_evidence(
        "AAPL",
        asof_date=ASOF,
        cfg=CFG,
        cache_root=tmp_path,
        refresh_sources=True,
    )

    assert result == []
    assert json.loads(cache_file.read_text()) == [_ev().model_dump()]


def test_partial_refresh_replaces_successful_source_and_preserves_failed_source(
    tmp_path, monkeypatch
):
    cache_file = tmp_path / ASOF.isoformat() / "AAPL.json"
    cache_file.parent.mkdir(parents=True)
    old_success = _ev().model_copy(
        update={"title": "old success", "url": "old-success", "publisher": "Fresh"}
    ).model_dump()
    old_success["source_id"] = "fresh"
    old_failed = _ev().model_copy(
        update={"title": "old failed", "url": "old-failed", "publisher": "Failed"}
    ).model_dump()
    old_failed["source_id"] = "failed"
    cache_file.write_text(json.dumps([old_success, old_failed]))

    class FreshCollector:
        @classmethod
        def collect(cls, ticker, *, asof_date, cfg):
            return [
                _ev().model_copy(
                    update={
                        "title": "new success",
                        "url": "new-success",
                        "publisher": "Fresh",
                    }
                )
            ]

    class FailedCollector:
        @classmethod
        def collect(cls, ticker, *, asof_date, cfg):
            raise RuntimeError("provider unavailable")

    monkeypatch.setattr(
        "swing_screener.intelligence.evidence.collect.registry.get_registered",
        lambda: {"fresh": FreshCollector, "failed": FailedCollector},
    )

    result = collect_evidence(
        "AAPL",
        asof_date=ASOF,
        cfg=EvidenceConfig(enabled_sources=("fresh", "failed")),
        cache_root=tmp_path,
        refresh_sources=True,
    )

    assert {(item.title, item.source_id) for item in result} == {
        ("new success", "fresh"),
        ("old failed", "failed"),
    }
    assert "old success" not in {item.title for item in result}


def test_latest_cached_evidence_summary_uses_newest_valid_ticker_cache(tmp_path):
    for cache_date, publisher, count in (
        ("2026-07-27", "Older source", 1),
        ("2026-07-28", "Latest source", 2),
    ):
        path = tmp_path / cache_date / "AAPL.json"
        path.parent.mkdir()
        path.write_text(
            json.dumps(
                [
                    _ev().model_copy(update={"publisher": publisher}).model_dump()
                    for _ in range(count)
                ]
            )
        )

    summary = read_latest_cached_evidence_summary(
        " aapl ", cache_root=tmp_path, current_date=date(2026, 7, 29),
    )

    assert summary.ticker == "AAPL"
    assert summary.cached_at == "2026-07-28"
    assert summary.item_count == 2
    assert summary.providers == ["Latest source"]
    assert summary.freshness_status == "cached"


def test_latest_cached_evidence_summary_marks_old_cache_stale(tmp_path):
    path = tmp_path / "2026-07-27" / "AAPL.json"
    path.parent.mkdir()
    path.write_text(json.dumps([_ev().model_dump()]))

    summary = read_latest_cached_evidence_summary(
        "AAPL",
        cache_root=tmp_path,
        current_date=date(2026, 7, 30),
        cfg=EvidenceConfig(cache_stale_after_days=1),
    )

    assert summary is not None
    assert summary.freshness_status == "stale"


def test_latest_cached_evidence_summary_does_not_mark_future_cache_fresh(tmp_path):
    path = tmp_path / "2026-07-31" / "AAPL.json"
    path.parent.mkdir()
    path.write_text(json.dumps([_ev().model_dump()]))

    summary = read_latest_cached_evidence_summary(
        "AAPL",
        cache_root=tmp_path,
        current_date=date(2026, 7, 30),
    )

    assert summary is not None
    assert summary.freshness_status == "stale"
