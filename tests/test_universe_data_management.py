from pathlib import Path

from swing_screener.data.universe import (
    list_package_universes,
    filter_ticker_list,
    save_universe_file,
    apply_universe_config,
    UniverseConfig,
)


def test_list_package_universes_includes_mega():
    universes = list_package_universes()
    assert "mega" in universes


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
