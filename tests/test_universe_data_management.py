import pytest

from swing_screener.data.universe import (
    list_package_universes,
    filter_ticker_list,
    filter_tickers_by_metadata,
    apply_universe_config,
    UniverseConfig,
    load_universe_from_package,
)


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
