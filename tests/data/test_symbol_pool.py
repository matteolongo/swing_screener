from swing_screener.data.symbol_pool import (
    PoolSymbol,
    pool_symbol_to_dict,
    pool_symbol_from_dict,
    POOL_SCHEMA_VERSION,
    derive_region,
    derive_cap_tier,
    derive_liquidity_tier,
    derive_instrument_detail,
    derive_providers,
)


def test_pool_symbol_roundtrips_through_dict():
    sym = PoolSymbol(
        symbol="AAPL",
        exchange_mic="XNAS",
        currency="USD",
        region="us",
        market_cap_tier="large",
        sector="Technology",
        industry="Consumer Electronics",
        index_memberships=["us_sp500", "broad_market_stocks"],
        liquidity_tier="high",
        instrument_type="equity",
        instrument_type_detail="equity",
        available_providers=["yfinance"],
        primary_provider="yfinance",
        taxonomy_refreshed_at="2026-06-30",
        fetch_failure_count=0,
        last_fetch_ok_at=None,
    )
    d = pool_symbol_to_dict(sym)
    assert d["symbol"] == "AAPL"
    assert d["index_memberships"] == ["us_sp500", "broad_market_stocks"]
    assert pool_symbol_from_dict(d) == sym


def test_pool_symbol_from_dict_tolerates_missing_optional_fields():
    sym = pool_symbol_from_dict({"symbol": "MSFT"})
    assert sym.symbol == "MSFT"
    assert sym.fetch_failure_count == 0
    assert sym.index_memberships == []
    assert sym.available_providers == []
    assert POOL_SCHEMA_VERSION == 1


def test_derive_region_from_mic():
    assert derive_region("XNAS", "US") == "us"
    assert derive_region("XAMS", "NL") == "europe"
    assert derive_region("XTKS", "JP") == "asia_pacific"
    assert derive_region("ZZZZ", None) == "other"


def test_derive_region_falls_back_to_country_when_mic_unknown():
    assert derive_region(None, "DE") == "europe"
    assert derive_region(None, "US") == "us"
    assert derive_region(None, "HK") == "asia_pacific"


def test_derive_cap_tier_buckets():
    assert derive_cap_tier(20_000_000_000) == "large"
    assert derive_cap_tier(5_000_000_000) == "mid"
    assert derive_cap_tier(1_000_000_000) == "small"
    assert derive_cap_tier(100_000_000) == "micro"
    assert derive_cap_tier(None) is None


def test_derive_liquidity_tier_buckets():
    assert derive_liquidity_tier(100_000_000) == "high"
    assert derive_liquidity_tier(10_000_000) == "mid"
    assert derive_liquidity_tier(1_000_000) == "low"
    assert derive_liquidity_tier(None) is None


def test_derive_instrument_detail():
    assert derive_instrument_detail("EQUITY", None, "equity") == "equity"
    assert derive_instrument_detail("ETF", "Technology", "etf") == "etf_sector"
    assert derive_instrument_detail("ETF", "Trading--Leveraged Equity", "etf") == "etf_leveraged"
    assert derive_instrument_detail("ETF", "Corporate Bond", "etf") == "etf_bond"
    assert derive_instrument_detail("ETF", "Commodities Focused", "etf") == "etf_commodity"
    assert derive_instrument_detail("ETF", "Large Blend", "etf") == "etf_equity"
    assert derive_instrument_detail(None, None, "etf") == "etf_equity"


def test_derive_providers_defaults_to_yfinance():
    assert derive_providers(None) == (["yfinance"], "yfinance")
    assert derive_providers({}) == (["yfinance"], "yfinance")


def test_derive_providers_maps_known_keys():
    available, primary = derive_providers({"yahoo_finance": "AAPL", "degiro": "1234"})
    assert set(available) == {"yfinance", "degiro"}
    assert primary == "yfinance"
