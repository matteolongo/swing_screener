from swing_screener.data.symbol_pool import (
    PoolSymbol,
    pool_symbol_to_dict,
    pool_symbol_from_dict,
    POOL_SCHEMA_VERSION,
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
