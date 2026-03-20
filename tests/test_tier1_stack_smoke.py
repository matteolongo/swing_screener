"""
Integration smoke test for the Tier 1 free-first data stack.

All sub-tests use mocked HTTP — no real network calls are made.
Run with:
    pytest tests/test_tier1_stack_smoke.py -v

These tests are excluded from the default CI run by the 'integration' marker:
    pytest tests/ -m "not integration"
"""
from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_stooq_provider(df: pd.DataFrame | None = None):
    """Return a StooqDataProvider whose fetch_ohlcv always returns `df`."""
    from swing_screener.data.providers.stooq_provider import StooqDataProvider

    provider = StooqDataProvider.__new__(StooqDataProvider)
    provider.timeout_sec = 10.0
    provider.fetch_ohlcv = MagicMock(return_value=df if df is not None else pd.DataFrame())
    return provider


def _make_sec_edgar_provider(record=None, raises=None):
    """Return a SecEdgarFundamentalsProvider stub."""
    from swing_screener.fundamentals.providers.sec_edgar import SecEdgarFundamentalsProvider

    provider = SecEdgarFundamentalsProvider.__new__(SecEdgarFundamentalsProvider)
    if raises:
        provider.fetch_record = MagicMock(side_effect=raises)
    else:
        provider.fetch_record = MagicMock(return_value=record)
    return provider


def _make_yfinance_fundamentals_provider(record=None):
    """Return a YfinanceFundamentalsProvider stub."""
    from swing_screener.fundamentals.providers.yfinance import YfinanceFundamentalsProvider

    provider = YfinanceFundamentalsProvider.__new__(YfinanceFundamentalsProvider)
    provider.fetch_record = MagicMock(return_value=record)
    return provider


def _minimal_record(symbol: str, provider: str, data_region: str | None = None):
    """Return a minimal ProviderFundamentalsRecord for testing."""
    from swing_screener.fundamentals.models import ProviderFundamentalsRecord

    return ProviderFundamentalsRecord(
        symbol=symbol,
        asof_date=date.today().isoformat(),
        provider=provider,
        instrument_type="equity",
        data_region=data_region,
    )


# ---------------------------------------------------------------------------
# Test 1: OHLCV path — yfinance primary, Stooq fallback for EU ticker
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_ohlcv_yfinance_with_stooq_fallback(tmp_path):
    """AAPL is served by yfinance; AIR.PA falls through to Stooq."""
    from swing_screener.data.providers.yfinance_provider import YfinanceProvider

    aapl_df = pd.DataFrame(
        {"Close": [180.0, 181.0]},
        index=pd.to_datetime(["2026-03-18", "2026-03-19"]),
    )
    aapl_multi = pd.DataFrame(
        {("Close", "AAPL"): [180.0, 181.0]},
        index=pd.to_datetime(["2026-03-18", "2026-03-19"]),
    )
    aapl_multi.columns = pd.MultiIndex.from_tuples(aapl_multi.columns)

    airpa_df = pd.DataFrame(
        {("Close", "AIR.PA"): [145.0, 146.0]},
        index=pd.to_datetime(["2026-03-18", "2026-03-19"]),
    )
    airpa_df.columns = pd.MultiIndex.from_tuples(airpa_df.columns)

    stooq_provider = _make_stooq_provider(airpa_df)

    provider = YfinanceProvider(
        cache_dir=str(tmp_path / "cache"),
        stooq_fallback_enabled=True,
        stooq_provider=stooq_provider,
    )

    # Patch yf.download to return AAPL data for AAPL, empty for AIR.PA
    def fake_download(tickers, **kwargs):
        if isinstance(tickers, list) and "AAPL" in tickers and "AIR.PA" not in tickers:
            return aapl_multi
        if isinstance(tickers, list) and "AIR.PA" in tickers:
            # Return empty so Stooq fallback kicks in
            return pd.DataFrame()
        return aapl_multi

    with patch("swing_screener.data.providers.yfinance_provider.yf.download", side_effect=fake_download):
        aapl_result = provider.fetch_ohlcv(
            ["AAPL"],
            start_date="2026-03-18",
            end_date="2026-03-19",
            use_cache=False,
        )
        airpa_result = provider.fetch_ohlcv(
            ["AIR.PA"],
            start_date="2026-03-18",
            end_date="2026-03-19",
            use_cache=False,
        )

    assert not aapl_result.empty, "AAPL data should come from yfinance"
    stooq_provider.fetch_ohlcv.assert_called_once()
    assert not airpa_result.empty, "AIR.PA data should fall back to Stooq"


# ---------------------------------------------------------------------------
# Test 2: US fundamentals — SEC EDGAR primary
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_us_fundamentals_from_sec_edgar(tmp_path):
    """AAPL fetched from SEC EDGAR; provider and data_region are correct."""
    from swing_screener.fundamentals.config import FundamentalsConfig
    from swing_screener.fundamentals.service import FundamentalsAnalysisService
    from swing_screener.fundamentals.storage import FundamentalsStorage

    record = _minimal_record("AAPL", "sec_edgar", data_region="US")
    sec_provider = _make_sec_edgar_provider(record)
    yf_provider = _make_yfinance_fundamentals_provider()

    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(root_dir=str(tmp_path / "store")),
        sec_edgar_provider=sec_provider,
        yfinance_provider=yf_provider,
    )
    cfg = FundamentalsConfig(providers=("sec_edgar", "yfinance"))
    snapshot = service.get_snapshot("AAPL", cfg=cfg, force_refresh=True)

    assert snapshot.provider == "sec_edgar"
    assert snapshot.data_region == "US"
    yf_provider.fetch_record.assert_not_called()


# ---------------------------------------------------------------------------
# Test 3: EU fundamentals fallback — SEC EDGAR has no CIK, yfinance fills in
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_eu_fundamentals_fallback_to_yfinance(tmp_path):
    """AIR.PA is not in SEC EDGAR; yfinance fallback provides data_region=EU."""
    from swing_screener.fundamentals.config import FundamentalsConfig
    from swing_screener.fundamentals.service import FundamentalsAnalysisService
    from swing_screener.fundamentals.storage import FundamentalsStorage

    yf_record = _minimal_record("AIR.PA", "yfinance", data_region="EU")
    sec_provider = _make_sec_edgar_provider(raises=RuntimeError("No CIK found for AIR.PA"))
    yf_provider = _make_yfinance_fundamentals_provider(yf_record)

    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(root_dir=str(tmp_path / "store")),
        sec_edgar_provider=sec_provider,
        yfinance_provider=yf_provider,
    )
    cfg = FundamentalsConfig(providers=("sec_edgar", "yfinance"))
    snapshot = service.get_snapshot("AIR.PA", cfg=cfg, force_refresh=True)

    assert snapshot.provider == "yfinance"
    assert snapshot.data_region == "EU"
    yf_provider.fetch_record.assert_called_once()


# ---------------------------------------------------------------------------
# Test 4: Evidence collection — sec_edgar + company_ir_rss adapters
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_evidence_collection_sec_edgar_and_company_ir_rss(tmp_path, monkeypatch):
    """sec_edgar and company_ir_rss adapters produce records with correct source_name."""
    from datetime import datetime

    from swing_screener.intelligence.config import SourcesConfig
    from swing_screener.intelligence.evidence import (
        CompanyIrRssEvidenceAdapter,
        SecEdgarEvidenceAdapter,
        resolve_instrument_profiles,
    )

    # --- SEC EDGAR API mock ---
    # Ticker map response
    ticker_map_payload = json.dumps({
        "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
    })
    # Submissions payload for AAPL (CIK 0000320193)
    submissions_payload = json.dumps({
        "filings": {
            "recent": {
                "form": ["10-Q", "8-K"],
                "filingDate": ["2026-03-15", "2026-03-10"],
                "primaryDocument": ["aapl-20260315.htm", "aapl-20260310.htm"],
            }
        }
    })

    # --- Company IR RSS mock ---
    ir_xml = """<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>AAPL Q1 2026 earnings release</title>
        <link>https://investor.apple.com/earnings/Q1-2026</link>
        <pubDate>Thu, 19 Mar 2026 15:00:00 GMT</pubDate>
        <description>Quarterly earnings press release</description>
      </item>
    </channel></rss>
    """

    ir_feeds_path = tmp_path / "company_ir_feeds.json"
    ir_feeds_path.write_text(json.dumps({"AAPL": ["https://investor.apple.com/rss.xml"]}))

    call_log: list[str] = []

    class _MockClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, url: str):
            call_log.append(url)
            if "company_tickers.json" in url:
                return httpx.Response(200, text=ticker_map_payload, request=httpx.Request("GET", url))
            if "submissions/CIK" in url:
                return httpx.Response(200, text=submissions_payload, request=httpx.Request("GET", url))
            if "investor.apple.com" in url:
                return httpx.Response(200, text=ir_xml, request=httpx.Request("GET", url))
            return httpx.Response(404, text="", request=httpx.Request("GET", url))

    monkeypatch.setattr("swing_screener.intelligence.evidence.httpx.Client", _MockClient)

    profiles = resolve_instrument_profiles(["AAPL"])
    start_dt = datetime(2026, 3, 1)
    end_dt = datetime(2026, 3, 31)
    cfg = SourcesConfig(enabled=("sec_edgar", "company_ir_rss"))

    sec_adapter = SecEdgarEvidenceAdapter()
    ir_adapter = CompanyIrRssEvidenceAdapter(feeds_path=ir_feeds_path)

    sec_records = sec_adapter.fetch_records(
        symbols=["AAPL"], profiles=profiles, start_dt=start_dt, end_dt=end_dt, cfg=cfg
    )
    ir_records = ir_adapter.fetch_records(
        symbols=["AAPL"], profiles=profiles, start_dt=start_dt, end_dt=end_dt, cfg=cfg
    )

    sec_names = {r.source_name for r in sec_records}
    ir_names = {r.source_name for r in ir_records}
    assert "sec_edgar" in sec_names, f"Expected sec_edgar in {sec_names}"
    assert "company_ir_rss" in ir_names, f"Expected company_ir_rss in {ir_names}"


# ---------------------------------------------------------------------------
# Test 5: OpenFIGI disabled — heuristic resolution, no network calls
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_openfigi_disabled_uses_heuristic(monkeypatch):
    """When SWING_SCREENER_OPENFIGI_ENABLED=false, profiles use heuristic mapping."""
    monkeypatch.setenv("SWING_SCREENER_OPENFIGI_ENABLED", "false")

    # Patch httpx.post to fail if called (would indicate a network attempt)
    def _no_network(*args, **kwargs):
        raise AssertionError("No network calls should be made when OpenFIGI is disabled")

    monkeypatch.setattr("swing_screener.intelligence.evidence.httpx.post", _no_network, raising=False)

    from swing_screener.intelligence.evidence import resolve_instrument_profiles

    profiles = resolve_instrument_profiles(["AAPL", "ADS.DE", "AIR.PA"])

    assert profiles["AAPL"].currency == "USD"
    assert profiles["ADS.DE"].currency == "EUR"
    assert profiles["AIR.PA"].currency == "EUR"
    # FIGI fields should be empty (heuristic path)
    assert profiles["AAPL"].figi is None or profiles["AAPL"].figi == ""
