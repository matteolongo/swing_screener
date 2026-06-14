from swing_screener.data.instrument_enrichment import enrich_symbol


def _info(**kw):
    base = {
        "exchange": "GER",
        "currency": "EUR",
        "quoteType": "EQUITY",
        "fullExchangeName": "XETRA",
    }
    base.update(kw)
    return lambda _symbol: base


def test_enrich_german_equity():
    rec = enrich_symbol("SAP.DE", info_provider=_info())
    assert rec["symbol"] == "SAP.DE"
    assert rec["exchange_mic"] == "XETR"
    assert rec["country_code"] == "DE"
    assert rec["currency"] == "EUR"
    assert rec["timezone"] == "Europe/Berlin"
    assert rec["instrument_type"] == "equity"
    assert rec["provider_symbol_map"]["yahoo_finance"] == "SAP.DE"
    assert rec["primary_listing"] is True
    assert rec["status"] == "active"
    assert rec["source"] == "wikipedia_yfinance"


def test_enrich_us_equity_maps_nasdaq():
    rec = enrich_symbol(
        "AAPL",
        info_provider=_info(
            exchange="NMS", currency="USD", fullExchangeName="NasdaqGS"
        ),
    )
    assert rec["exchange_mic"] == "XNAS"
    assert rec["country_code"] == "US"
    assert rec["timezone"] == "America/New_York"


def test_enrich_etf_type_mapped():
    rec = enrich_symbol(
        "SPY", info_provider=_info(exchange="PCX", currency="USD", quoteType="ETF")
    )
    assert rec["instrument_type"] == "etf"


def test_enrich_returns_none_when_unresolved():
    assert enrich_symbol("ZZZZ.XX", info_provider=lambda _s: {}) is None
    assert (
        enrich_symbol("ZZZZ.XX", info_provider=lambda _s: {"exchange": "WAT"}) is None
    )
