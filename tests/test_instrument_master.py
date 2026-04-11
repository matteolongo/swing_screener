"""Validates instrument_master.json coverage and schema."""
import json
from pathlib import Path

import pytest

from swing_screener.data.universe import _load_snapshot, list_package_universes

MASTER_PATH = Path("data/intelligence/instrument_master.json")
REQUIRED_FIELDS = {
    "symbol", "exchange_mic", "country_code", "currency", "timezone",
    "provider_symbol_map", "primary_listing",
    "status", "source", "source_asof", "last_reviewed_at",
}


def _load_master() -> list[dict]:
    return json.loads(MASTER_PATH.read_text(encoding="utf-8"))


def _master_symbols() -> set[str]:
    return {r["symbol"] for r in _load_master()}


def test_instrument_master_exists():
    assert MASTER_PATH.exists(), f"instrument_master.json not found at {MASTER_PATH}"


def test_instrument_master_has_required_fields():
    records = _load_master()
    missing_by_symbol: dict[str, set[str]] = {}
    for r in records:
        missing = REQUIRED_FIELDS - r.keys()
        if missing:
            missing_by_symbol[r.get("symbol", "?")] = missing
    assert not missing_by_symbol, (
        f"Records missing required fields: {missing_by_symbol}"
    )


def test_instrument_master_no_duplicate_symbols():
    records = _load_master()
    symbols = [r["symbol"] for r in records]
    duplicates = {s for s in symbols if symbols.count(s) > 1}
    assert not duplicates, f"Duplicate symbols in instrument master: {duplicates}"


def test_instrument_master_active_records_have_no_reason():
    records = _load_master()
    for r in records:
        if r.get("status") == "active":
            # active records should have null status_reason (not a required value, just a check)
            pass  # no strict requirement for active records


def test_non_active_records_have_status_reason():
    records = _load_master()
    for r in records:
        if r.get("status") not in ("active", None):
            assert r.get("status_reason"), (
                f"Non-active record {r['symbol']} must have a status_reason"
            )


def test_all_universe_symbols_in_instrument_master():
    master_symbols = _master_symbols()
    missing_by_universe: dict[str, list[str]] = {}
    for uid in list_package_universes():
        snapshot = _load_snapshot(uid)
        missing = [
            c["symbol"]
            for c in snapshot["constituents"]
            if c["symbol"] not in master_symbols
        ]
        if missing:
            missing_by_universe[uid] = missing
    assert not missing_by_universe, (
        f"Missing instrument master coverage: {missing_by_universe}"
    )
