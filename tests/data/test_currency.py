from swing_screener.data.currency import detect_currency


def test_detect_currency_defaults_to_usd_for_us_tickers():
    assert detect_currency("AAPL") == "USD"
    assert detect_currency("msft") == "USD"
    assert detect_currency("") == "USD"


def test_detect_currency_returns_eur_for_known_suffixes():
    assert detect_currency("ASML.AS") == "EUR"
    assert detect_currency("SAP.DE") == "EUR"
    assert detect_currency("OR.PA") == "EUR"


def test_detect_currency_unknown_suffix_falls_back_to_usd():
    assert detect_currency("ABC.TO") == "USD"
