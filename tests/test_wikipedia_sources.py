from pathlib import Path

import pytest

from swing_screener.data.wikipedia_sources import (
    WIKIPEDIA_INDEX_CONFIG,
    fetch_index_constituents,
    normalize_yahoo_symbol,
)

FIXTURES = Path(__file__).parent / "fixtures" / "wikipedia"


def _fixture_fetch(name):
    def _fetch(_url):
        return (FIXTURES / f"{name}.html").read_text(encoding="utf-8")

    return _fetch


def test_config_covers_eight_indices():
    assert set(WIKIPEDIA_INDEX_CONFIG) == {
        "us_sp500",
        "us_nasdaq100",
        "us_dow30",
        "germany_dax",
        "france_cac40",
        "uk_ftse100",
        "spain_ibex35",
        "europe_eurostoxx50",
    }


def test_dow30_parses_30_us_symbols():
    rows = fetch_index_constituents("us_dow30", fetch_text=_fixture_fetch("us_dow30"))
    assert len(rows) == 30
    assert all("." not in r.symbol or r.symbol.endswith(("-A", "-B")) for r in rows)
    assert any(r.source_name for r in rows)


def test_ftse100_symbols_get_london_suffix():
    rows = fetch_index_constituents(
        "uk_ftse100", fetch_text=_fixture_fetch("uk_ftse100")
    )
    assert 90 <= len(rows) <= 105
    assert all(r.symbol.endswith(".L") for r in rows)


@pytest.mark.parametrize(
    "raw,suffix,expected",
    [
        ("BRK.B", "", "BRK-B"),
        ("AAPL", "", "AAPL"),
        ("SAP", ".DE", "SAP.DE"),
        ("SAP.DE", ".DE", "SAP.DE"),
        ("ETR: ADS", ".DE", "ADS.DE"),
        ("BT.A", ".L", "BT-A.L"),
    ],
)
def test_normalize_yahoo_symbol(raw, suffix, expected):
    assert normalize_yahoo_symbol(raw, suffix) == expected


def test_empty_table_raises():
    from swing_screener.data.universe_sources import UniverseSourceError

    with pytest.raises(UniverseSourceError):
        fetch_index_constituents(
            "us_dow30", fetch_text=lambda _u: "<html><body>no tables</body></html>"
        )
