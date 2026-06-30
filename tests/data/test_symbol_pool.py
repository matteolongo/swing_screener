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
    build_pool_base,
    TaxonomyFilterSpec,
    filter_pool_by_taxonomy,
    enrich_pool_taxonomy,
    serialize_pool,
    deserialize_pool,
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
    assert (
        derive_instrument_detail("ETF", "Trading--Leveraged Equity", "etf")
        == "etf_leveraged"
    )
    assert derive_instrument_detail("ETF", "Corporate Bond", "etf") == "etf_bond"
    assert (
        derive_instrument_detail("ETF", "Commodities Focused", "etf") == "etf_commodity"
    )
    assert derive_instrument_detail("ETF", "Large Blend", "etf") == "etf_equity"
    assert derive_instrument_detail(None, None, "etf") == "etf_equity"


def test_derive_providers_defaults_to_yfinance():
    assert derive_providers(None) == (["yfinance"], "yfinance")
    assert derive_providers({}) == (["yfinance"], "yfinance")


def test_derive_providers_maps_known_keys():
    available, primary = derive_providers({"yahoo_finance": "AAPL", "degiro": "1234"})
    assert set(available) == {"yfinance", "degiro"}
    assert primary == "yfinance"


def test_build_pool_base_merges_snapshots_and_instrument_master():
    snapshots = {
        "us_sp500": {
            "id": "us_sp500",
            "constituents": [
                {"symbol": "AAPL", "exchange_mic": "XNAS", "currency": "USD"},
                {"symbol": "MSFT", "exchange_mic": "XNAS", "currency": "USD"},
            ],
        },
        "broad_market_stocks": {
            "id": "broad_market_stocks",
            "constituents": [
                {"symbol": "AAPL", "exchange_mic": "XNAS", "currency": "USD"},
                {"symbol": "ASML", "exchange_mic": "XAMS", "currency": "EUR"},
            ],
        },
    }
    instrument_master = {
        "AAPL": {
            "symbol": "AAPL",
            "exchange_mic": "XNAS",
            "currency": "USD",
            "country_code": "US",
            "instrument_type": "equity",
            "provider_symbol_map": {"yahoo_finance": "AAPL"},
        },
        "ASML": {
            "symbol": "ASML",
            "exchange_mic": "XAMS",
            "currency": "EUR",
            "country_code": "NL",
            "instrument_type": "equity",
            "provider_symbol_map": {"yahoo_finance": "ASML.AS", "degiro": "1001"},
        },
    }
    pool = build_pool_base(snapshots=snapshots, instrument_master=instrument_master)
    by_symbol = {s.symbol: s for s in pool}

    assert set(by_symbol) == {"AAPL", "MSFT", "ASML"}
    assert sorted(by_symbol["AAPL"].index_memberships) == [
        "broad_market_stocks",
        "us_sp500",
    ]
    assert by_symbol["AAPL"].region == "us"
    assert by_symbol["ASML"].region == "europe"
    assert set(by_symbol["ASML"].available_providers) == {"yfinance", "degiro"}
    assert by_symbol["ASML"].primary_provider == "yfinance"
    assert by_symbol["AAPL"].sector is None
    assert by_symbol["AAPL"].market_cap_tier is None


def test_build_pool_base_handles_symbol_absent_from_instrument_master():
    snapshots = {
        "x": {
            "id": "x",
            "constituents": [
                {"symbol": "NEW", "exchange_mic": "XNYS", "currency": "USD"}
            ],
        }
    }
    pool = build_pool_base(snapshots=snapshots, instrument_master={})
    sym = pool[0]
    assert sym.symbol == "NEW"
    assert sym.region == "us"
    assert sym.available_providers == ["yfinance"]
    assert sym.primary_provider == "yfinance"


def _mk(symbol, **kw):
    return PoolSymbol(symbol=symbol, **kw)


def test_filter_none_spec_returns_all():
    pool = [_mk("A", region="us"), _mk("B", region="europe")]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec())
    assert {s.symbol for s in out} == {"A", "B"}


def test_filter_single_dimension_or_within():
    pool = [
        _mk("A", region="us"),
        _mk("B", region="europe"),
        _mk("C", region="asia_pacific"),
    ]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec(region=("us", "europe")))
    assert {s.symbol for s in out} == {"A", "B"}


def test_filter_and_across_dimensions():
    pool = [
        _mk("A", region="us", market_cap_tier="large"),
        _mk("B", region="us", market_cap_tier="small"),
        _mk("C", region="europe", market_cap_tier="large"),
    ]
    out = filter_pool_by_taxonomy(
        pool, TaxonomyFilterSpec(region=("us",), market_cap_tier=("large",))
    )
    assert {s.symbol for s in out} == {"A"}


def test_filter_excludes_symbol_with_null_field_when_dimension_active():
    pool = [_mk("A", sector="Technology"), _mk("B", sector=None)]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec(sector=("Technology",)))
    assert {s.symbol for s in out} == {"A"}


def test_filter_index_membership_matches_any():
    pool = [
        _mk("A", index_memberships=["us_sp500"]),
        _mk("B", index_memberships=["germany_dax"]),
    ]
    out = filter_pool_by_taxonomy(
        pool, TaxonomyFilterSpec(index_memberships=("us_sp500",))
    )
    assert {s.symbol for s in out} == {"A"}


def test_filter_provider_matches_available():
    pool = [
        _mk("A", available_providers=["yfinance", "degiro"]),
        _mk("B", available_providers=["yfinance"]),
    ]
    out = filter_pool_by_taxonomy(pool, TaxonomyFilterSpec(provider=("degiro",)))
    assert {s.symbol for s in out} == {"A"}


def test_enrich_populates_yfinance_fields():
    pool = [PoolSymbol(symbol="AAPL", instrument_type="equity")]
    info = {
        "AAPL": {
            "sector": "Technology",
            "industry": "Consumer Electronics",
            "marketCap": 3_000_000_000_000,
            "averageVolume": 50_000_000,
            "regularMarketPrice": 200.0,
            "quoteType": "EQUITY",
            "category": None,
        }
    }
    failed = enrich_pool_taxonomy(pool, info_fn=info.get, asof_date="2026-06-30")
    assert failed == []
    s = pool[0]
    assert s.sector == "Technology"
    assert s.market_cap_tier == "large"
    assert s.liquidity_tier == "high"  # 50M * 200 = 10B dollar volume
    assert s.instrument_type_detail == "equity"
    assert s.taxonomy_refreshed_at == "2026-06-30"


def test_enrich_records_failures_and_continues():
    pool = [PoolSymbol(symbol="GOOD"), PoolSymbol(symbol="BAD")]
    info = {
        "GOOD": {
            "sector": "Energy",
            "marketCap": 5e9,
            "averageVolume": 1e6,
            "regularMarketPrice": 50.0,
            "quoteType": "EQUITY",
        }
    }

    def info_fn(sym):
        if sym == "BAD":
            raise RuntimeError("network")
        return info.get(sym)

    failed = enrich_pool_taxonomy(pool, info_fn=info_fn, asof_date="2026-06-30")
    assert failed == ["BAD"]
    assert pool[0].sector == "Energy"
    assert pool[1].sector is None


def test_serialize_deserialize_roundtrip():
    pool = [PoolSymbol(symbol="AAPL", region="us", index_memberships=["us_sp500"])]
    payload = serialize_pool(pool, asof_date="2026-06-30")
    assert payload["schema_version"] == 1
    assert payload["asof"] == "2026-06-30"
    assert payload["symbols"][0]["symbol"] == "AAPL"
    restored = deserialize_pool(payload)
    assert restored == pool
