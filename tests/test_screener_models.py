import pytest
from pydantic import ValidationError

from api.models.screener import PriceHistoryPoint, CandlePatternOut, ScreenerRequest
from swing_screener.data.currencies import supported_currency_codes


def test_screener_request_accepts_exact_currency_registry():
    assert ScreenerRequest(
        currencies=list(supported_currency_codes())
    ).currencies == list(supported_currency_codes())


def test_screener_request_rejects_currency_outside_registry():
    with pytest.raises(ValidationError, match="Unsupported currency codes: JPY"):
        ScreenerRequest(currencies=["JPY"])


def test_price_history_point_optional_ohlcv_defaults_none():
    p = PriceHistoryPoint(date="2024-01-01", close=10.0)
    assert p.open is None and p.high is None and p.low is None and p.volume is None


def test_price_history_point_with_ohlcv():
    p = PriceHistoryPoint(
        date="2024-01-01", close=10.0, open=9.5, high=10.2, low=9.4, volume=1000
    )
    assert p.high == 10.2


def test_candle_pattern_out():
    cp = CandlePatternOut(
        bar_index=5,
        date="2024-01-01",
        name="hammer",
        direction="bullish",
        key_level=9.0,
        context="at_pullback",
    )
    assert cp.name == "hammer"
