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


