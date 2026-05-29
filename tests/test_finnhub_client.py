from __future__ import annotations

import datetime as dt
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


def test_fetch_recommendation_score_net_bull():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = [
        {"period": "2026-05-01", "strongBuy": 15, "buy": 20, "hold": 7, "sell": 2, "strongSell": 0}
    ]
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        score = client._fetch_recommendation_score("AAPL")

    assert score == pytest.approx(33.0)  # 15 + 20 - 2 - 0


def test_fetch_recommendation_score_returns_none_on_empty():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = []
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        score = client._fetch_recommendation_score("AAPL")

    assert score is None


def test_fetch_recommendation_score_returns_none_on_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("network")):
        score = client._fetch_recommendation_score("AAPL")

    assert score is None


def test_fetch_price_target_returns_median():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = {"targetHigh": 300.0, "targetLow": 180.0, "targetMedian": 235.0}
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        target = client._fetch_price_target("AAPL")

    assert target == pytest.approx(235.0)


def test_fetch_price_target_returns_none_on_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("timeout")):
        target = client._fetch_price_target("AAPL")

    assert target is None


def test_fetch_beat_streak_counts_consecutive_beats():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = [
        {"period": "2026-03-31", "actual": 1.65, "estimate": 1.62},
        {"period": "2025-12-31", "actual": 2.40, "estimate": 2.35},
        {"period": "2025-09-30", "actual": 1.50, "estimate": 1.55},  # miss
        {"period": "2025-06-30", "actual": 1.30, "estimate": 1.20},
    ]
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        streak = client._fetch_beat_streak("AAPL")

    assert streak == 2  # stops at the miss in Q3 2025


def test_fetch_beat_streak_zero_on_first_miss():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    resp = MagicMock()
    resp.json.return_value = [
        {"period": "2026-03-31", "actual": 1.50, "estimate": 1.62},  # miss
        {"period": "2025-12-31", "actual": 2.40, "estimate": 2.35},
    ]
    resp.raise_for_status = MagicMock()

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=resp):
        streak = client._fetch_beat_streak("AAPL")

    assert streak == 0


def test_fetch_beat_streak_returns_none_on_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")

    with patch("swing_screener.fundamentals.finnhub_client.httpx.get",
               side_effect=Exception("network")):
        streak = client._fetch_beat_streak("AAPL")

    assert streak is None


def test_enrich_applies_all_signals():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record()

    with patch.object(client, "_fetch_metric_supplement", return_value={"gross_margin": 0.46}):
        with patch.object(client, "_fetch_recommendation_score", return_value=33.0):
            with patch.object(client, "_fetch_price_target", return_value=235.0):
                with patch.object(client, "_fetch_beat_streak", return_value=4):
                    enriched = client.enrich(record)

    assert enriched.gross_margin == pytest.approx(0.46)
    assert enriched.analyst_recommendation_score == pytest.approx(33.0)
    assert enriched.analyst_price_target == pytest.approx(235.0)
    assert enriched.earnings_beat_streak == 4


def test_enrich_one_failed_signal_does_not_block_others():
    """Price target failure must not prevent recommendation score from being applied."""
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test_key")
    record = _make_record()

    with patch.object(client, "_fetch_metric_supplement", return_value={}):
        with patch.object(client, "_fetch_recommendation_score", return_value=33.0):
            with patch.object(client, "_fetch_price_target", return_value=None):
                with patch.object(client, "_fetch_beat_streak", return_value=None):
                    enriched = client.enrich(record)

    assert enriched.analyst_recommendation_score == pytest.approx(33.0)
    assert enriched.analyst_price_target is None


def _mock_http(json_body) -> MagicMock:
    resp = MagicMock()
    resp.json.return_value = json_body
    resp.raise_for_status = MagicMock()
    return resp


def test_fetch_insider_net_shares_positive_for_net_buyer():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test")
    payload = {
        "data": [
            {"change": 5000, "transactionCode": "P", "transactionDate": "2026-05-01"},
            {"change": -2000, "transactionCode": "S", "transactionDate": "2026-04-20"},
            {"change": 3000, "transactionCode": "P", "transactionDate": "2026-04-10"},
        ]
    }
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=_mock_http(payload)):
        net, count = client._fetch_insider_transactions("AAPL")

    assert net == 6000   # 5000 + 3000 - 2000
    assert count == 3


def test_fetch_insider_returns_none_on_empty_data():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test")
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=_mock_http({"data": []})):
        net, count = client._fetch_insider_transactions("AAPL")

    assert net is None
    assert count is None


def test_fetch_forward_eps_returns_first_quarter_estimate():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test")
    payload = {
        "data": [
            {"eps": 1.55, "period": "2026Q2", "numberAnalyst": 12},
            {"eps": 1.70, "period": "2026Q3", "numberAnalyst": 10},
        ],
        "freq": "quarterly",
        "symbol": "AAPL",
    }
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=_mock_http(payload)):
        result = client._fetch_forward_eps_estimate("AAPL")

    assert result == pytest.approx(1.55)


def test_fetch_forward_eps_returns_none_on_empty():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test")
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=_mock_http({"data": []})):
        result = client._fetch_forward_eps_estimate("AAPL")

    assert result is None


def test_fetch_upgrade_downgrade_net_counts_correctly():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test")
    today = dt.date.today()
    recent = (today - dt.timedelta(days=15)).strftime("%Y-%m-%d")
    old = (today - dt.timedelta(days=45)).strftime("%Y-%m-%d")
    payload = [
        {"action": "up", "company": "Morgan Stanley", "gradeTime": int(dt.datetime.strptime(recent, "%Y-%m-%d").timestamp())},
        {"action": "up", "company": "Goldman Sachs", "gradeTime": int(dt.datetime.strptime(recent, "%Y-%m-%d").timestamp())},
        {"action": "down", "company": "JP Morgan", "gradeTime": int(dt.datetime.strptime(recent, "%Y-%m-%d").timestamp())},
        {"action": "up", "company": "Old Firm", "gradeTime": int(dt.datetime.strptime(old, "%Y-%m-%d").timestamp())},
    ]
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", return_value=_mock_http(payload)):
        result = client._fetch_upgrade_downgrade_net("AAPL")

    assert result == 1  # 2 ups - 1 down in last 30 days; old one excluded


def test_fetch_upgrade_downgrade_returns_none_on_error():
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    client = FinnhubEnrichmentClient(api_key="test")
    with patch("swing_screener.fundamentals.finnhub_client.httpx.get", side_effect=Exception("timeout")):
        result = client._fetch_upgrade_downgrade_net("AAPL")

    assert result is None
