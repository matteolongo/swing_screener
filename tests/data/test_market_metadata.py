from swing_screener.data.providers.market_metadata import (
    MARKET_SUFFIX,
    COUNTRY_BY_MARKET,
    CURRENCY_BY_MARKET,
    EXCHANGE_BY_MARKET,
    market_from_ticker,
)


def test_market_suffix_covers_expected_eu_markets():
    expected = {".PA", ".AS", ".MI", ".DE", ".L", ".SW", ".ST", ".MC", ".HE", ".BR"}
    assert expected.issubset(set(MARKET_SUFFIX.keys()))


def test_market_from_ticker_eu():
    assert market_from_ticker("ASML.AS") == "nl"
    assert market_from_ticker("MC.PA") == "fr"
    assert market_from_ticker("ENI.MI") == "it"
    assert market_from_ticker("ABI.BR") == "be"


def test_market_from_ticker_us_default():
    assert market_from_ticker("AAPL") == "us"
    assert market_from_ticker("MSFT") == "us"


def test_country_by_market_complete():
    for market in MARKET_SUFFIX.values():
        assert market in COUNTRY_BY_MARKET, f"Missing country for market {market!r}"


def test_currency_by_market_complete():
    for market in MARKET_SUFFIX.values():
        assert market in CURRENCY_BY_MARKET, f"Missing currency for market {market!r}"


def test_exchange_by_market_complete():
    for market in MARKET_SUFFIX.values():
        assert market in EXCHANGE_BY_MARKET, f"Missing exchange for market {market!r}"


def test_us_in_supporting_maps():
    assert COUNTRY_BY_MARKET["us"] == "US"
    assert CURRENCY_BY_MARKET["us"] == "USD"
