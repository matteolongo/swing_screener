"""Live Finnhub integration tests. Require FINNHUB_API_KEY env var. Skipped in CI."""
from __future__ import annotations

import os
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


def test_metric_supplement_gross_margin_in_expected_range(client):
    result = client._fetch_metric_supplement(AAPL)
    gm = result.get("gross_margin")
    assert gm is not None, "gross_margin should be populated for AAPL"
    assert 0.35 <= gm <= 0.60, f"AAPL gross margin should be ~46%, got {gm}"


def test_metric_supplement_scale_factors_yield_decimals(client):
    """All margin/ROE fields must be in [0, 1] range after scale conversion."""
    result = client._fetch_metric_supplement(AAPL)
    for field in ("gross_margin", "net_margin", "operating_margin", "return_on_equity"):
        value = result.get(field)
        if value is not None:
            assert 0 < value < 2, f"{field}={value} looks like it wasn't divided by 100"


def test_recommendation_score_is_numeric(client):
    score = client._fetch_recommendation_score(AAPL)
    assert score is not None
    assert isinstance(score, float)


def test_price_target_is_positive(client):
    target = client._fetch_price_target(AAPL)
    assert target is not None
    assert target > 0


def test_beat_streak_is_non_negative_int(client):
    streak = client._fetch_beat_streak(AAPL)
    assert streak is not None
    assert isinstance(streak, int)
    assert streak >= 0
