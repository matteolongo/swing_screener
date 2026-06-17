import json

import pytest

import swing_screener.data.universe as universe_mod
from swing_screener.data.universe import (
    list_package_universes,
    filter_ticker_list,
    filter_tickers_by_metadata,
    apply_universe_config,
    UniverseConfig,
    load_universe_from_package,
)
from swing_screener.data.universe_sources import UniverseSourceResult


def test_list_package_universes_returns_new_ids():
    universes = list_package_universes()
    assert "broad_market_stocks" in universes
    assert "amsterdam_aex" in universes
    assert "europe_large_caps" in universes
    # Old ids must not be present
    assert "usd_all" not in universes
    assert "eur_all" not in universes
    assert "mega_all" not in universes


def test_filter_ticker_list_include_exclude_and_grep():
    base = ["AAA", "BBB", "SPY", "TECH1"]
    filtered = filter_ticker_list(
        base,
        include=["ZZZ"],
        exclude=["BBB"],
        grep="T",
    )
    # grep keeps TECH1, include adds ZZZ, exclude removes BBB, SPY dropped by grep
    assert filtered == ["TECH1", "ZZZ"]


def test_apply_universe_config_benchmark_and_max():
    tickers = ["AAA", "BBB"]
    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=2)
    applied = apply_universe_config(tickers, cfg)
    # Max tickers keeps 2; benchmark replaces last slot
    assert applied[-1] == "SPY"


def test_load_broad_market_stocks_returns_non_empty():
    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=False)
    tickers = load_universe_from_package("broad_market_stocks", cfg)
    assert len(tickers) > 50
    assert "AAPL" in tickers


def test_load_amsterdam_all_returns_non_empty():
    cfg = UniverseConfig(benchmark="^AEX", ensure_benchmark=False)
    tickers = load_universe_from_package("amsterdam_all", cfg)
    assert len(tickers) > 10
    assert all("." in t for t in tickers)  # All Amsterdam tickers have suffix


def test_load_unknown_id_raises_value_error():
    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=False)
    with pytest.raises(ValueError, match="Unknown universe id"):
        load_universe_from_package("mega_all", cfg)


def test_load_old_usd_id_raises_value_error():
    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=False)
    with pytest.raises(ValueError, match="Unknown universe id"):
        load_universe_from_package("usd_all", cfg)


def test_load_removed_eur_all_raises_value_error():
    cfg = UniverseConfig(benchmark="VGK", ensure_benchmark=False)
    with pytest.raises(ValueError, match="Unknown universe id"):
        load_universe_from_package("eur_all", cfg)


def test_filter_tickers_by_metadata_respects_exchange_and_instrument_type():
    filtered = filter_tickers_by_metadata(
        ["AAPL", "SPY", "ASML.AS", "BAESY"],
        currencies=["USD", "EUR"],
        exchange_mics=["XNAS", "XNYS", "XAMS"],
        include_otc=False,
        instrument_types=["equity"],
    )
    assert filtered == ["AAPL", "ASML.AS"]


def test_refresh_apply_merges_new_master_records(monkeypatch, tmp_path):
    master_path = tmp_path / "instrument_master.json"
    master_path.write_text(
        json.dumps(
            [
                {
                    "symbol": "AAPL",
                    "exchange_mic": "XNAS",
                    "currency": "USD",
                    "source": "manual",
                }
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        universe_mod,
        "_INSTRUMENT_MASTER_PATH_OVERRIDE",
        str(master_path),
        raising=False,
    )
    universe_mod._instrument_master_cache.cache_clear()

    snapshot = {
        "id": "us_sp500",
        "source_adapter": "wikipedia_index_review",
        "constituents": [],
        "rules": {},
    }
    monkeypatch.setattr(universe_mod, "_load_snapshot", lambda _id: dict(snapshot))
    monkeypatch.setattr(
        universe_mod,
        "get_universe_meta",
        lambda _id: {"id": "us_sp500", "kind": "index"},
    )
    monkeypatch.setattr(universe_mod, "_write_snapshot", lambda _id, _snap: None)

    result = UniverseSourceResult(
        source_adapter="wikipedia_index_review",
        source_asof="2026-06-12",
        source_documents=[],
        notes=[],
        constituents=[
            {
                "symbol": "MSFT",
                "exchange_mic": "XNAS",
                "currency": "USD",
                "source_name": "Microsoft",
                "source_symbol": "MSFT",
            }
        ],
        new_master_records=[
            {
                "symbol": "MSFT",
                "exchange_mic": "XNAS",
                "currency": "USD",
                "source": "wikipedia_yfinance",
            }
        ],
    )
    monkeypatch.setattr(
        universe_mod, "refresh_snapshot_from_source", lambda *a, **k: result
    )

    universe_mod.refresh_package_universe("us_sp500", apply=True)

    written = json.loads(master_path.read_text(encoding="utf-8"))
    symbols = {r["symbol"]: r for r in written}
    assert "MSFT" in symbols
    assert symbols["AAPL"]["source"] == "manual"


def test_materialize_auto_universe_persists_and_loads(monkeypatch, tmp_path):
    from swing_screener.data.auto_universe import (
        AutoUniverseFilter,
        AutoUniverseRequest,
        SymbolDiscoveryQuery,
        materialize_auto_universe,
    )
    from swing_screener.data.symbol_discovery import SymbolDiscoveryResult

    store_path = tmp_path / "auto_universes.json"
    import swing_screener.data.auto_universe as auto_mod

    monkeypatch.setattr(auto_mod, "_AUTO_STORE_PATH_OVERRIDE", str(store_path), raising=False)

    result = SymbolDiscoveryResult(
        provider="yahoo_predefined",
        source_asof="2026-06-16",
        source_documents=[{"label": "fixture", "url": "https://example.test"}],
        filters={"limit": 3},
        symbols=[
            {"symbol": "AAPL", "currency": "USD", "exchange_mic": "XNAS", "instrument_type": "EQUITY", "volume": 1000000, "market_cap": 1000000000, "last_price": 200},
            {"symbol": "PINK", "currency": "USD", "exchange_mic": "XOTC", "instrument_type": "EQUITY", "volume": 1000, "market_cap": 1000, "last_price": 1},
        ],
        taxonomy={"currency": {"USD": 2}},
        notes=["fixture"],
    )
    request = AutoUniverseRequest(
        universe_id="Auto USD Liquid",
        discovery=SymbolDiscoveryQuery(limit=3, currencies=("USD",)),
        filters=AutoUniverseFilter(currencies=("USD",), exchange_mics=("XNAS",), min_volume=100000, min_price=5),
    )

    payload = materialize_auto_universe(request, discovery_result=result, apply=True)

    assert payload["applied"] is True
    assert payload["universe"]["id"] == "auto_usd_liquid"
    assert load_universe_from_package("auto_usd_liquid", UniverseConfig(benchmark="SPY", ensure_benchmark=False)) == ["AAPL"]
    assert "auto_usd_liquid" in list_package_universes()
