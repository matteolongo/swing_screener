from pathlib import Path

import pandas as pd

from swing_screener.portfolio.state import Position, save_positions
from ui.helpers import (
    list_available_universes,
    ensure_parent_dir,
    load_positions_to_dataframe,
    dataframe_to_positions,
    safe_read_csv_preview,
)


def test_list_available_universes_includes_mega():
    universes = list_available_universes()
    assert "mega" in universes


def test_ensure_parent_dir_creates_parent(tmp_path: Path):
    target = tmp_path / "a" / "b" / "c.csv"
    ensure_parent_dir(target)
    assert (tmp_path / "a" / "b").exists()


def test_positions_dataframe_roundtrip(tmp_path: Path):
    p = Position(
        ticker="AAA",
        status="open",
        entry_date="2024-01-02",
        entry_price=100.0,
        stop_price=90.0,
        shares=10,
        initial_risk=10.0,
        max_favorable_price=110.0,
        notes="note",
    )
    path = tmp_path / "positions.json"
    save_positions(path, [p], asof="2024-01-03")

    df = load_positions_to_dataframe(path)
    rebuilt = dataframe_to_positions(df, existing=[p])

    assert rebuilt[0].ticker == "AAA"
    assert rebuilt[0].initial_risk == 10.0
    assert rebuilt[0].max_favorable_price == 110.0


def test_safe_read_csv_preview(tmp_path: Path):
    path = tmp_path / "sample.csv"
    pd.DataFrame({"a": [1, 2]}).to_csv(path, index=False)
    df, err = safe_read_csv_preview(path)
    assert err is None
    assert not df.empty
