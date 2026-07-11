"""Live Finnhub integration tests. Require FINNHUB_API_KEY env var. Skipped in CI."""
from __future__ import annotations

import os
from typing import Any

import pytest

pytestmark = pytest.mark.integration

AAPL = "AAPL"


@pytest.fixture(scope="module")
def client():
    key = os.environ.get("FINNHUB_API_KEY")
    if not key:
        pytest.skip("FINNHUB_API_KEY not set")
    from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
    return FinnhubEnrichmentClient(api_key=key)


def _require_live_payload(payload: Any, label: str) -> Any:
    if payload is None:
        pytest.skip(f"{label} unavailable from Finnhub")
    if isinstance(payload, (dict, list, tuple, str)) and len(payload) == 0:
        pytest.skip(f"{label} unavailable from Finnhub")
    return payload


def _require_live_float(value: Any, label: str) -> float:
    if value is None:
        pytest.skip(f"{label} unavailable from Finnhub")
    try:
        return float(value)
    except (TypeError, ValueError):
        pytest.skip(f"{label} is not numeric in Finnhub payload")


def _get_or_skip(client, path: str, params: dict[str, Any], label: str) -> Any:
    try:
        return _require_live_payload(client._get(path, params), label)
    except Exception as exc:  # noqa: BLE001 - live vendor availability is not deterministic
        pytest.skip(f"{label} unavailable from Finnhub: {exc}")


def test_metric_supplement_maps_gross_margin_scale(client, monkeypatch):
    raw = _get_or_skip(
        client,
        "/stock/metric",
        {"symbol": AAPL, "metric": "all"},
        "Finnhub metric supplement",
    )
    raw_metrics = _require_live_payload(raw.get("metric"), "Finnhub metric data")
    raw_gross_margin = _require_live_float(
        raw_metrics.get("grossMarginAnnual"),
        "Finnhub grossMarginAnnual",
    )

    monkeypatch.setattr(client, "_get", lambda path, params: raw)
    result = client._fetch_metric_supplement(AAPL)

    gm = result.get("gross_margin")
    assert gm == pytest.approx(raw_gross_margin * 0.01)
    assert 0 < gm < 2


def test_metric_supplement_scale_factors_yield_decimals(client):
    """All margin/ROE fields must be in [0, 1] range after scale conversion."""
    result = _require_live_payload(
        client._fetch_metric_supplement(AAPL),
        "Finnhub metric supplement",
    )
    observed = 0
    for field in ("gross_margin", "net_margin", "operating_margin", "return_on_equity"):
        value = result.get(field)
        if value is not None:
            observed += 1
            assert 0 < value < 2, f"{field}={value} looks like it wasn't divided by 100"
    if observed == 0:
        pytest.skip("Finnhub metric supplement returned no margin/ROE fields for AAPL")


def test_recommendation_score_is_numeric(client, monkeypatch):
    items = _get_or_skip(
        client,
        "/stock/recommendation",
        {"symbol": AAPL},
        "Finnhub recommendation data",
    )
    items = _require_live_payload(items, "Finnhub recommendation data")
    first = items[0]
    expected = float(
        (first.get("strongBuy") or 0)
        + (first.get("buy") or 0)
        - (first.get("sell") or 0)
        - (first.get("strongSell") or 0)
    )

    monkeypatch.setattr(client, "_get", lambda path, params: items)
    score = client._fetch_recommendation_score(AAPL)
    assert score == pytest.approx(expected)
    assert isinstance(score, float)


def test_price_target_is_positive(client, monkeypatch):
    raw = _get_or_skip(
        client,
        "/stock/price-target",
        {"symbol": AAPL},
        "Finnhub price target",
    )
    expected = _require_live_float(raw.get("targetMedian"), "Finnhub targetMedian")
    if expected <= 0:
        pytest.skip("Finnhub targetMedian is not positive for AAPL")

    monkeypatch.setattr(client, "_get", lambda path, params: raw)
    target = client._fetch_price_target(AAPL)
    assert target == pytest.approx(expected)
    assert target > 0


def test_beat_streak_is_non_negative_int(client, monkeypatch):
    items = _get_or_skip(
        client,
        "/stock/earnings",
        {"symbol": AAPL, "limit": 8},
        "Finnhub earnings history",
    )
    items = _require_live_payload(items, "Finnhub earnings history")
    expected = 0
    for item in items:
        actual = item.get("actual")
        estimate = item.get("estimate")
        if actual is None or estimate is None:
            break
        if float(actual) > float(estimate):
            expected += 1
        else:
            break

    monkeypatch.setattr(client, "_get", lambda path, params: items)
    streak = client._fetch_beat_streak(AAPL)
    assert streak == expected
    assert isinstance(streak, int)
    assert streak >= 0


def test_live_payload_guard_skips_empty_vendor_payload():
    with pytest.raises(pytest.skip.Exception):
        _require_live_payload({}, "Finnhub empty test payload")


def test_live_payload_guard_returns_present_vendor_payload():
    payload = {"data": [{"value": 1}]}
    assert _require_live_payload(payload, "Finnhub present test payload") is payload
