from pathlib import Path

import pytest

from swing_screener.data.wikipedia_sources import (
    WIKIPEDIA_INDEX_CONFIG,
    _csi_symbol,
    _hangseng_symbol,
    _kospi_symbol,
    fetch_index_constituents,
    normalize_yahoo_symbol,
)

FIXTURES = Path(__file__).parent / "fixtures" / "wikipedia"


def _fixture_fetch(name):
    def _fetch(_url):
        return (FIXTURES / f"{name}.html").read_text(encoding="utf-8")

    return _fetch


def test_config_covers_eleven_indices():
    assert set(WIKIPEDIA_INDEX_CONFIG) == {
        "us_sp500",
        "us_nasdaq100",
        "us_dow30",
        "germany_dax",
        "france_cac40",
        "uk_ftse100",
        "spain_ibex35",
        "europe_eurostoxx50",
        "hongkong_hsi",
        "korea_kospi200",
        "china_csi300",
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
        ("RB.", ".L", "RB.L"),
    ],
)
def test_normalize_yahoo_symbol(raw, suffix, expected):
    assert normalize_yahoo_symbol(raw, suffix) == expected


def test_sp500_selects_main_table_not_changes():
    rows = fetch_index_constituents("us_sp500", fetch_text=_fixture_fetch("us_sp500"))
    assert 490 <= len(rows) <= 520
    assert all(r.symbol == r.symbol.upper() for r in rows)
    # US symbols carry no exchange suffix (dotted class shares become dashes)
    assert all("." not in r.symbol for r in rows)


def test_eurostoxx_resolves_venue_suffixes_and_bare_source_symbol():
    rows = fetch_index_constituents(
        "europe_eurostoxx50", fetch_text=_fixture_fetch("europe_eurostoxx50")
    )
    assert 40 <= len(rows) <= 55
    assert any("." in r.symbol for r in rows)
    # source_symbol must be the bare ticker (regression guard for the suffix bug)
    for r in rows:
        assert (
            "." not in r.source_symbol
        ), f"{r.symbol} -> {r.source_symbol} kept suffix"


def test_empty_table_raises():
    from swing_screener.data.universe_sources import UniverseSourceError

    with pytest.raises(UniverseSourceError):
        fetch_index_constituents(
            "us_dow30", fetch_text=lambda _u: "<html><body>no tables</body></html>"
        )


def test_missing_html_parser_surfaces_clear_error(monkeypatch):
    """A missing read_html parser must not be masked as 'no constituent table'."""
    import swing_screener.data.wikipedia_sources as ws
    from swing_screener.data.universe_sources import UniverseSourceError

    def _boom(*_args, **_kwargs):
        raise ImportError("Import lxml failed.")

    monkeypatch.setattr(ws.pd, "read_html", _boom)
    with pytest.raises(UniverseSourceError) as excinfo:
        fetch_index_constituents("us_dow30", fetch_text=lambda _u: "<html></html>")
    message = str(excinfo.value).lower()
    assert "lxml" in message or "parser" in message
    assert "no constituent table" not in message


def test_hangseng_symbol_strips_prefix_and_zero_pads_to_4():
    assert _hangseng_symbol("SEHK:\xa05") == "0005.HK"
    assert _hangseng_symbol("SEHK: 700") == "0700.HK"
    assert _hangseng_symbol("SEHK: 1299") == "1299.HK"
    assert _hangseng_symbol("") == ""


def test_kospi_symbol_zero_pads_to_6():
    assert _kospi_symbol("005930") == "005930.KS"
    assert _kospi_symbol(5930) == "005930.KS"   # pandas may coerce to int
    assert _kospi_symbol("090430") == "090430.KS"
    assert _kospi_symbol("nan") == ""


def test_csi_symbol_routes_shanghai_and_shenzhen():
    assert _csi_symbol("SSE: 600519") == "600519.SS"
    assert _csi_symbol("SZSE: 000333") == "000333.SZ"
    assert _csi_symbol("SZSE: 300750") == "300750.SZ"
    assert _csi_symbol("600519") == ""          # no venue prefix -> drop


def test_hangseng_parses_constituents():
    rows = fetch_index_constituents("hongkong_hsi", fetch_text=_fixture_fetch("hongkong_hsi"))
    syms = {r.symbol for r in rows}
    assert len(rows) >= 78
    assert all(s.endswith(".HK") and len(s.split(".")[0]) >= 4 for s in syms)
    assert "0700.HK" in syms  # Tencent


def test_kospi200_parses_200_constituents():
    rows = fetch_index_constituents("korea_kospi200", fetch_text=_fixture_fetch("korea_kospi200"))
    syms = {r.symbol for r in rows}
    assert len(rows) >= 195
    assert all(s.endswith(".KS") and len(s.split(".")[0]) == 6 for s in syms)
    assert "005930.KS" in syms  # Samsung Electronics


def test_csi300_parses_constituents_with_dual_venue():
    rows = fetch_index_constituents("china_csi300", fetch_text=_fixture_fetch("china_csi300"))
    syms = {r.symbol for r in rows}
    assert len(rows) >= 295
    assert any(s.endswith(".SS") for s in syms)
    assert any(s.endswith(".SZ") for s in syms)
    assert "600519.SS" in syms  # Kweichow Moutai
