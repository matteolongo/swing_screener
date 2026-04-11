from swing_screener.data.currency import detect_currency


def test_detect_currency_uses_instrument_master_for_known_us_tickers():
    # AAPL is in instrument_master.json with currency USD
    assert detect_currency("AAPL") == "USD"
    assert detect_currency("msft") == "USD"  # case-insensitive via .upper()


def test_detect_currency_returns_unknown_for_empty():
    # Empty ticker returns UNKNOWN — no coercion
    assert detect_currency("") == "UNKNOWN"


def test_detect_currency_returns_eur_for_known_suffixes():
    assert detect_currency("ASML.AS") == "EUR"
    assert detect_currency("SAP.DE") == "EUR"
    assert detect_currency("OR.PA") == "EUR"


def test_detect_currency_returns_gbp_for_london_suffix():
    assert detect_currency("AZN.L") == "GBP"


def test_detect_currency_returns_chf_for_swiss_suffix():
    assert detect_currency("NESN.SW") == "CHF"


def test_detect_currency_returns_sek_for_stockholm_suffix():
    assert detect_currency("VOLV-B.ST") == "SEK"


def test_detect_currency_returns_dkk_for_copenhagen_suffix():
    assert detect_currency("NOVO-B.CO") == "DKK"


def test_detect_currency_returns_nok_for_oslo_suffix():
    assert detect_currency("EQNR.OL") == "NOK"


def test_detect_currency_unknown_suffix_returns_unknown():
    # .TO (Toronto) is not in the suffix map → UNKNOWN, not USD
    assert detect_currency("ABC.TO") == "UNKNOWN"


def test_detect_currency_no_suffix_unknown_ticker_returns_unknown():
    # Tickers not in instrument master and without suffix return UNKNOWN
    assert detect_currency("ZZZZZZZ") == "UNKNOWN"
