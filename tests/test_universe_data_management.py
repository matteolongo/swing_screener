from pathlib import Path

from swing_screener.data.universe import (
    list_package_universes,
    filter_ticker_list,
    save_universe_file,
    apply_universe_config,
    UniverseConfig,
    load_universe_from_package,
)


def test_list_package_universes_includes_currency_all():
    universes = list_package_universes()
    assert "usd_all" in universes
    assert "eur_all" in universes


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


def test_save_universe_file_and_apply_config(tmp_path: Path):
    tickers = ["AAA", "BBB"]
    path = save_universe_file(tickers, tmp_path / "out.csv")
    assert path.exists()
    text = path.read_text(encoding="utf-8").strip().splitlines()
    assert text == tickers

    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=2)
    applied = apply_universe_config(tickers, cfg)
    # Max tickers keeps 2; benchmark replaces last slot
    assert applied[-1] == "SPY"


def test_universe_aliases_resolve_to_usd_all():
    cfg = UniverseConfig(benchmark="SPY", ensure_benchmark=False)
    by_alias = load_universe_from_package("mega", cfg)
    by_legacy = load_universe_from_package("mega_all", cfg)
    by_canonical = load_universe_from_package("usd_all", cfg)
    assert by_alias == by_canonical
    assert by_legacy == by_canonical


def test_universe_alias_amsterdam_all_resolves():
    cfg = UniverseConfig(benchmark="VGK", ensure_benchmark=False)
    by_legacy = load_universe_from_package("amsterdam_all", cfg)
    by_canonical = load_universe_from_package("eur_amsterdam_all", cfg)
    assert by_legacy == by_canonical
