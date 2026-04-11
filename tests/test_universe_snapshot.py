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
        "europe_large_eur", "europe_proxies_usd",
        "us_all", "us_mega_stocks", "us_core_etfs",
        "us_defense_all", "us_defense_stocks", "us_defense_etfs",
        "us_healthcare_all", "us_healthcare_stocks", "us_healthcare_etfs",
    }
    assert expected == set(ids)


def test_list_package_universes_sorted():
    ids = list_package_universes()
    assert ids == sorted(ids)


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def test_load_us_all_non_empty():
    tickers = load_universe_from_package("us_all", _CFG_NO_BENCH)
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


def test_benchmark_us_all():
    assert get_universe_benchmark("us_all") == "SPY"


def test_benchmark_europe_large_eur():
    assert get_universe_benchmark("europe_large_eur") == "VGK"


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
        "id": "us_all",
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
    for c in snapshot["constituents"]:
        assert c["exchange_mic"] == "XAMS", f"{c['symbol']} has wrong MIC: {c['exchange_mic']}"
        assert c["currency"] == "EUR", f"{c['symbol']} has wrong currency: {c['currency']}"


def test_amsterdam_amx_all_xams():
    snapshot = _load_snapshot("amsterdam_amx")
    for c in snapshot["constituents"]:
        assert c["exchange_mic"] == "XAMS", f"{c['symbol']} has wrong MIC: {c['exchange_mic']}"
        assert c["currency"] == "EUR"


def test_amsterdam_all_all_xams():
    snapshot = _load_snapshot("amsterdam_all")
    for c in snapshot["constituents"]:
        assert c["exchange_mic"] == "XAMS", f"{c['symbol']} has wrong MIC"
        assert c["currency"] == "EUR"


def test_europe_large_eur_no_gbp():
    snapshot = _load_snapshot("europe_large_eur")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".L"), (
            f"GBP ticker {c['symbol']} should not be in europe_large_eur"
        )


def test_europe_large_eur_no_chf():
    snapshot = _load_snapshot("europe_large_eur")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".SW"), (
            f"CHF ticker {c['symbol']} should not be in europe_large_eur"
        )


def test_europe_large_eur_no_sek():
    snapshot = _load_snapshot("europe_large_eur")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".ST"), (
            f"SEK ticker {c['symbol']} should not be in europe_large_eur"
        )


def test_europe_large_eur_no_dkk():
    snapshot = _load_snapshot("europe_large_eur")
    for c in snapshot["constituents"]:
        assert not c["symbol"].endswith(".CO"), (
            f"DKK ticker {c['symbol']} should not be in europe_large_eur"
        )


def test_europe_proxies_usd_all_usd():
    snapshot = _load_snapshot("europe_proxies_usd")
    for c in snapshot["constituents"]:
        assert c["currency"] == "USD", (
            f"{c['symbol']} has currency {c['currency']}, expected USD in europe_proxies_usd"
        )


def test_us_all_no_suffix_tickers():
    snapshot = _load_snapshot("us_all")
    non_us = [c["symbol"] for c in snapshot["constituents"] if c["currency"] != "USD"]
    assert not non_us, f"Non-USD tickers in us_all: {non_us}"


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------

def test_validate_universe_snapshot_returns_list():
    errors = validate_universe_snapshot("amsterdam_aex")
    assert isinstance(errors, list)
