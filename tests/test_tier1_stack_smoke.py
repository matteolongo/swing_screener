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


