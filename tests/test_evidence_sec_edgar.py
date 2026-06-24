from datetime import date

from swing_screener.intelligence.evidence.collectors.sec_edgar import SecEdgarCatalystCollector
from swing_screener.intelligence.evidence.config import EvidenceConfig

CFG = EvidenceConfig()

TICKERS = {"0": {"ticker": "AAPL", "cik_str": 320193, "title": "Apple Inc"}}
SUBMISSIONS = {
    "filings": {
        "recent": {
            "form": ["8-K", "10-Q", "6-K"],
            "filingDate": ["2026-06-18", "2026-05-01", "2026-06-10"],
            "accessionNumber": ["0000320193-26-000080", "0000320193-26-000070", "0000320193-26-000075"],
            "primaryDocDescription": ["Results of Operations", "Quarterly Report", "Press release"],
            "items": ["2.02,9.01", "", ""],
        }
    }
}


def _fake_get_json(url):
    if "company_tickers.json" in url:
        return TICKERS
    if "submissions/CIK0000320193.json" in url:
        return SUBMISSIONS
    raise AssertionError(f"unexpected url {url}")


def test_keeps_only_8k_6k_and_maps_fields():
    out = SecEdgarCatalystCollector.collect("AAPL", asof_date=date(2026, 6, 24), cfg=CFG, get_json=_fake_get_json)
    forms = [e.relevance for e in out]
    assert any("8-K" in r for r in forms)
    assert any("6-K" in r for r in forms)
    assert all("10-Q" not in r for r in forms)
    first = next(e for e in out if "8-K" in e.relevance)
    assert first.publisher == "SEC EDGAR"
    assert first.published_at == "2026-06-18"
    assert first.url == "https://www.sec.gov/Archives/edgar/data/320193/000032019326000080/0000320193-26-000080-index.htm"
    assert "2.02" in first.quote_or_summary


def test_unmapped_ticker_returns_empty():
    out = SecEdgarCatalystCollector.collect("NOPE", asof_date=date(2026, 6, 24), cfg=CFG, get_json=_fake_get_json)
    assert out == []


def test_describe_shape():
    d = SecEdgarCatalystCollector.describe()
    assert d.id == "sec_edgar_catalysts"
    assert d.domain == "intelligence"
    assert d.probeable is True
    assert d.canary_market == "us"


def test_probe_ok_with_injected_client(monkeypatch):
    monkeypatch.setattr(
        "swing_screener.intelligence.evidence.collectors.sec_edgar._default_get_json",
        lambda cfg: _fake_get_json,
    )
    result = SecEdgarCatalystCollector.probe("AAPL")
    assert result.id == "sec_edgar_catalysts"
    assert result.status == "ok"
    assert result.sample["count"] >= 1
