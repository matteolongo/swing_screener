"""Tests for the registry-backed universe system."""
import datetime
import warnings
from unittest.mock import patch

import pytest

from swing_screener.data.universe import (
    UniverseConfig,
    _load_registry_manifest,
    _load_snapshot,
    _check_stale,
    get_universe_benchmark,
    get_universe_meta,
    list_package_universes,
    load_universe_from_package,
    validate_universe_snapshot,
)

_CFG_NO_BENCH = UniverseConfig(benchmark="SPY", ensure_benchmark=False)


# ---------------------------------------------------------------------------
# Registry manifest
# ---------------------------------------------------------------------------

def test_list_package_universes_count():
    ids = list_package_universes()
    assert len(ids) == 14, f"Expected 14 universes, got {len(ids)}: {ids}"


def test_list_package_universes_contains_expected():
    ids = list_package_universes()
    expected = {
        "amsterdam_aex", "amsterdam_amx", "amsterdam_all",
        "broad_market_stocks", "broad_market_etfs",
        "europe_large_caps", "global_proxy_stocks",
        "defense_stocks", "defense_etfs",
        "healthcare_stocks", "healthcare_etfs",
        "semiconductor_stocks", "energy_stocks", "financial_stocks",
    }
    assert expected == set(ids)


def test_list_package_universes_sorted():
    ids = list_package_universes()
    assert ids == sorted(ids)


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def test_load_broad_market_stocks_non_empty():
    tickers = load_universe_from_package("broad_market_stocks", _CFG_NO_BENCH)
    assert len(tickers) > 50
    assert "AAPL" in tickers


def test_load_amsterdam_aex_non_empty():
    tickers = load_universe_from_package("amsterdam_aex", _CFG_NO_BENCH)
    assert len(tickers) >= 10


def test_load_unknown_id_raises():
    with pytest.raises(ValueError, match="Unknown universe id"):
        load_universe_from_package("mega_all", _CFG_NO_BENCH)


def test_load_old_usd_prefix_raises():
    with pytest.raises(ValueError, match="Unknown universe id"):
        load_universe_from_package("usd_all", _CFG_NO_BENCH)


def test_load_eur_all_raises():
    with pytest.raises(ValueError, match="Unknown universe id"):
        load_universe_from_package("eur_all", _CFG_NO_BENCH)


# ---------------------------------------------------------------------------
# Benchmark lookup
# ---------------------------------------------------------------------------

def test_benchmark_amsterdam_aex():
    assert get_universe_benchmark("amsterdam_aex") == "^AEX"


def test_benchmark_amsterdam_amx():
    assert get_universe_benchmark("amsterdam_amx") == "^AMX"


def test_benchmark_broad_market_stocks():
    assert get_universe_benchmark("broad_market_stocks") == "ACWI"


def test_benchmark_europe_large_caps():
    assert get_universe_benchmark("europe_large_caps") == "VGK"


def test_benchmark_unknown_returns_none():
    assert get_universe_benchmark("nonexistent_id") is None


# ---------------------------------------------------------------------------
# Stale check
# ---------------------------------------------------------------------------

def test_stale_index_hard_fails():
    stale_snapshot = {
        "id": "amsterdam_aex",
        "kind": "index",
        "last_reviewed_at": "2020-01-01",
        "stale_after_days": 100,
        "constituents": [{"symbol": "ASML.AS", "exchange_mic": "XAMS", "currency": "EUR"}],
    }
    with pytest.raises(RuntimeError, match="stale"):
        _check_stale(stale_snapshot)


def test_stale_curated_warns_but_does_not_raise():
    stale_snapshot = {
        "id": "broad_market_stocks",
        "kind": "curated",
        "last_reviewed_at": "2020-01-01",
        "stale_after_days": 100,
        "constituents": [],
    }
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        _check_stale(stale_snapshot)
    assert any("stale" in str(warning.message).lower() for warning in w)


def test_fresh_snapshot_does_not_raise_or_warn():
    today = datetime.date.today().isoformat()
    fresh_snapshot = {
        "id": "amsterdam_aex",
        "kind": "index",
        "last_reviewed_at": today,
        "stale_after_days": 100,
        "constituents": [],
    }
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        _check_stale(fresh_snapshot)
    assert not w


# ---------------------------------------------------------------------------
# Content rules
# ---------------------------------------------------------------------------

def test_amsterdam_aex_all_xams():
    snapshot = _load_snapshot("amsterdam_aex")
    assert len(snapshot["constituents"]) == 30
    for c in snapshot["constituents"]:
        assert c["exchange_mic"] == "XAMS", f"{c['symbol']} has wrong MIC: {c['exchange_mic']}"
        assert c["currency"] == "EUR", f"{c['symbol']} has wrong currency: {c['currency']}"


def test_amsterdam_amx_official_membership_includes_air_france_klm():
    snapshot = _load_snapshot("amsterdam_amx")
    assert len(snapshot["constituents"]) == 25
    symbols = {c["symbol"] for c in snapshot["constituents"]}
    assert "AF.PA" in symbols
    for c in snapshot["constituents"]:
        assert c["currency"] == "EUR"
        assert c["exchange_mic"] in {"XAMS", "XPAR"}, f"{c['symbol']} has wrong MIC: {c['exchange_mic']}"


def test_amsterdam_all_tracks_verified_aex_plus_amx_membership():
    snapshot = _load_snapshot("amsterdam_all")
    assert len(snapshot["constituents"]) == 55
    symbols = {c["symbol"] for c in snapshot["constituents"]}
    assert "AF.PA" in symbols
    for c in snapshot["constituents"]:
        assert c["currency"] == "EUR"
        assert c["exchange_mic"] in {"XAMS", "XPAR"}, f"{c['symbol']} has wrong MIC"


def test_europe_large_caps_no_gbp():
    snapshot = _load_snapshot("europe_large_caps")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".L"), (
            f"GBP ticker {c['symbol']} should not be in europe_large_caps"
        )


def test_europe_large_caps_no_chf():
    snapshot = _load_snapshot("europe_large_caps")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".SW"), (
            f"CHF ticker {c['symbol']} should not be in europe_large_caps"
        )


def test_europe_large_caps_no_sek():
    snapshot = _load_snapshot("europe_large_caps")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".ST"), (
            f"SEK ticker {c['symbol']} should not be in europe_large_caps"
        )


def test_europe_large_caps_no_dkk():
    snapshot = _load_snapshot("europe_large_caps")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".CO"), (
            f"DKK ticker {c['symbol']} should not be in europe_large_caps"
        )


def test_global_proxy_stocks_all_usd():
    snapshot = _load_snapshot("global_proxy_stocks")
    for c in snapshot["constituents"]:
        assert c["currency"] == "USD", (
            f"{c['symbol']} has currency {c['currency']}, expected USD in global_proxy_stocks"
        )


def test_broad_market_etfs_contains_eur_and_usd():
    snapshot = _load_snapshot("broad_market_etfs")
    currencies = {c["currency"] for c in snapshot["constituents"]}
    assert currencies == {"USD", "EUR"}


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------

def test_validate_universe_snapshot_returns_list():
    errors = validate_universe_snapshot("amsterdam_aex")
    assert isinstance(errors, list)
