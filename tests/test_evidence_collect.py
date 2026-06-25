from datetime import date

import swing_screener.intelligence.evidence.collect as collect_mod
from swing_screener.intelligence.evidence.collect import collect_evidence
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

    monkeypatch.setattr(collect_mod.SecEdgarCatalystCollector, "collect", classmethod(lambda cls, *a, **k: fake_collect(*a, **k)))
    out1 = collect_evidence("AAPL", asof_date=ASOF, cfg=CFG, cache_root=tmp_path)
    out2 = collect_evidence("AAPL", asof_date=ASOF, cfg=CFG, cache_root=tmp_path)
    assert len(out1) == 1 and len(out2) == 1
    assert calls["n"] == 1  # second call served from cache


def test_failing_collector_records_fallback_and_degrades(tmp_path, monkeypatch):
    source_health.reset_fallback_events()

    def boom(cls, *a, **k):
        raise RuntimeError("feed down")

    monkeypatch.setattr(collect_mod.SecEdgarCatalystCollector, "collect", classmethod(boom))
    out = collect_evidence("AAPL", asof_date=ASOF, cfg=CFG, cache_root=tmp_path)
    assert out == []
    events = source_health.recent_events()
    assert any(e.from_provider == "sec_edgar_catalysts" and e.domain == "intelligence" for e in events)
