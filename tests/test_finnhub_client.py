from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

from swing_screener.fundamentals.models import ProviderFundamentalsRecord


def _make_record(**kwargs) -> ProviderFundamentalsRecord:
    defaults = {"symbol": "AAPL", "asof_date": "2026-05-27", "provider": "yfinance"}
    return ProviderFundamentalsRecord(**{**defaults, **kwargs})


def _mock_metric_response(metrics: dict) -> MagicMock:
    resp = MagicMock()
    resp.json.return_value = {"metric": metrics}
    resp.raise_for_status = MagicMock()
    return resp


def test_fetch_metric_supplement_fills_none_gross_margin():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               return_value=_mock_metric_response({"grossMarginAnnual": 46.56})):
        result = client._fetch_metric_supplement("AAPL")

    assert result.get("gross_margin") == pytest.approx(0.4656, rel=1e-3)


def test_fetch_metric_supplement_does_not_return_fields_with_none_values():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               return_value=_mock_metric_response({"grossMarginAnnual": None})):
        result = client._fetch_metric_supplement("AAPL")

    assert "gross_margin" not in result


def test_fetch_metric_supplement_maps_all_known_keys():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    raw = {
        "grossMarginAnnual": 46.56,
        "netProfitMarginAnnual": 26.31,
        "operatingMarginAnnual": 31.51,
        "revenueGrowthAnnualYoy": 0.04,
        "epsGrowthAnnualYoy": 0.10,
        "roeAnnual": 136.07,
        "currentRatioAnnual": 0.87,
        "totalDebt/totalEquityAnnual": 198.47,
        "peAnnual": 33.09,
        "pbAnnual": 45.85,
    }
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               return_value=_mock_metric_response(raw)):
        result = client._fetch_metric_supplement("AAPL")

    assert set(result.keys()) == {
        "gross_margin", "net_margin", "operating_margin",
        "revenue_growth_yoy", "earnings_growth_yoy",
        "return_on_equity", "current_ratio", "debt_to_equity",
        "trailing_pe", "price_to_book",
    }


def test_fetch_metric_supplement_returns_empty_dict_on_http_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("timeout")):
        result = client._fetch_metric_supplement("AAPL")

    assert result == {}


def test_enrich_fills_none_fields_from_supplement():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record(gross_margin=None, operating_margin=0.25)

    with patch.object(client, "_fetch_metric_supplement",
                      return_value={"gross_margin": 0.46, "operating_margin": 0.30}):
        with patch.object(client, "_fetch_recommendation_score", return_value=None):
            with patch.object(client, "_fetch_price_target", return_value=None):
                with patch.object(client, "_fetch_beat_streak", return_value=None):
                    enriched = client.enrich(record)

    assert enriched.gross_margin == pytest.approx(0.46)
    assert enriched.operating_margin == 0.25  # not overwritten


def test_enrich_returns_same_record_when_no_updates():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record(gross_margin=0.46)

    with patch.object(client, "_fetch_metric_supplement", return_value={}):
        with patch.object(client, "_fetch_recommendation_score", return_value=None):
            with patch.object(client, "_fetch_price_target", return_value=None):
                with patch.object(client, "_fetch_beat_streak", return_value=None):
                    enriched = client.enrich(record)

    assert enriched is record
