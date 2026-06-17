from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from swing_screener.data.symbol_discovery import SymbolDiscoveryQuery, SymbolDiscoveryResult, discover_symbols
from swing_screener.data.universe import normalize_tickers

_AUTO_STORE_PATH_OVERRIDE: str | None = None


def _auto_store_path() -> Path:
    if _AUTO_STORE_PATH_OVERRIDE:
        return Path(_AUTO_STORE_PATH_OVERRIDE).resolve()
    return Path(os.getenv("SWING_SCREENER_AUTO_UNIVERSES_FILE", "data/intelligence/auto_universes.json")).resolve()


def _empty_store() -> dict:
    return {"schema_version": 1, "universes": {}, "symbol_registry": {}}


def load_auto_universe_store() -> dict:
    path = _auto_store_path()
    if not path.exists():
        return _empty_store()
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Auto-universe store must be a JSON object: {path}")
    payload.setdefault("schema_version", 1)
    payload.setdefault("universes", {})
    payload.setdefault("symbol_registry", {})
    return payload


def _write_auto_universe_store(payload: dict) -> None:
    path = _auto_store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def _normalize_str_set(values: Iterable[str] | None) -> set[str]:
    return {str(value).strip().upper() for value in (values or []) if str(value).strip()}


@dataclass(frozen=True)
class AutoUniverseFilter:
    currencies: tuple[str, ...] = ()
    exchange_mics: tuple[str, ...] = ()
    instrument_types: tuple[str, ...] = ("EQUITY",)
    min_price: float | None = None
    max_price: float | None = None
    min_volume: int | None = None
    min_market_cap: int | None = None
    exclude_symbols: tuple[str, ...] = ()
    pinned_symbols: tuple[str, ...] = ()


@dataclass(frozen=True)
class AutoUniverseRequest:
    universe_id: str = "auto_liquid_supported"
    description: str = "Auto-curated liquid supported symbols"
    benchmark: str = "SPY"
    discovery: SymbolDiscoveryQuery = field(default_factory=SymbolDiscoveryQuery)
    filters: AutoUniverseFilter = field(default_factory=AutoUniverseFilter)


def _slug(value: str) -> str:
    out = "".join(ch.lower() if ch.isalnum() else "_" for ch in str(value).strip())
    out = "_".join(part for part in out.split("_") if part)
    if not out:
        raise ValueError("universe_id cannot be empty")
    return out


def _coerce_float(value: object) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _coerce_int(value: object) -> int | None:
    try:
        if value in (None, ""):
            return None
        return int(float(str(value)))
    except (TypeError, ValueError):
        return None


def _passes_auto_filters(symbol: dict, filters: AutoUniverseFilter) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    currencies = _normalize_str_set(filters.currencies)
    exchange_mics = _normalize_str_set(filters.exchange_mics)
    instrument_types = _normalize_str_set(filters.instrument_types)
    excluded = _normalize_str_set(filters.exclude_symbols)

    ticker = str(symbol.get("symbol") or "").strip().upper()
    if not ticker or ticker in excluded:
        return False, reasons

    currency = str(symbol.get("currency") or "").strip().upper()
    if currencies and currency not in currencies:
        return False, reasons
    if currencies:
        reasons.append(f"currency:{currency}")

    exchange_mic = str(symbol.get("exchange_mic") or "").strip().upper()
    if exchange_mics and exchange_mic not in exchange_mics:
        return False, reasons
    if exchange_mics:
        reasons.append(f"exchange_mic:{exchange_mic}")

    instrument_type = str(symbol.get("instrument_type") or "").strip().upper()
    if instrument_types and instrument_type not in instrument_types:
        return False, reasons
    if instrument_types:
        reasons.append(f"instrument_type:{instrument_type}")

    price = _coerce_float(symbol.get("last_price") or symbol.get("regular_market_price"))
    if filters.min_price is not None and (price is None or price < filters.min_price):
        return False, reasons
    if filters.max_price is not None and (price is None or price > filters.max_price):
        return False, reasons
    if price is not None:
        reasons.append("price_range")

    volume = _coerce_int(symbol.get("volume"))
    if filters.min_volume is not None and (volume is None or volume < filters.min_volume):
        return False, reasons
    if filters.min_volume is not None:
        reasons.append("min_volume")

    market_cap = _coerce_int(symbol.get("market_cap"))
    if filters.min_market_cap is not None and (market_cap is None or market_cap < filters.min_market_cap):
        return False, reasons
    if filters.min_market_cap is not None:
        reasons.append("min_market_cap")

    return True, reasons or ["discovered"]


def _filter_definition_hash(request: AutoUniverseRequest) -> str:
    payload = {
        "discovery": request.discovery.__dict__,
        "filters": request.filters.__dict__,
        "benchmark": request.benchmark,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=list).encode("utf-8")).hexdigest()[:16]


def materialize_auto_universe(
    request: AutoUniverseRequest,
    *,
    discovery_result: SymbolDiscoveryResult | None = None,
    apply: bool = False,
) -> dict:
    universe_id = _slug(request.universe_id)
    result = discovery_result or discover_symbols(request.discovery)
    pinned = normalize_tickers(request.filters.pinned_symbols) if request.filters.pinned_symbols else []
    pinned_set = set(pinned)
    members: list[dict] = []
    registry_updates: dict[str, dict] = {}
    seen: set[str] = set()

    for item in result.symbols:
        symbol = str(item.get("symbol") or "").strip().upper()
        if not symbol or symbol in seen:
            continue
        passed, reasons = _passes_auto_filters(item, request.filters)
        if not passed and symbol not in pinned_set:
            continue
        seen.add(symbol)
        registry_updates[symbol] = {**item, "last_seen_at": dt.date.today().isoformat(), "provider": result.provider}
        members.append(
            {
                "symbol": symbol,
                "source": item.get("source") or result.provider,
                "source_rank": item.get("discovery_rank"),
                "inclusion_reasons": ["pinned"] if symbol in pinned_set else reasons,
                "currency": item.get("currency"),
                "exchange_mic": item.get("exchange_mic"),
                "instrument_type": item.get("instrument_type"),
            }
        )

    for symbol in pinned:
        if symbol not in seen:
            members.append({"symbol": symbol, "source": "pinned", "inclusion_reasons": ["pinned"]})
            registry_updates.setdefault(symbol, {"symbol": symbol, "last_seen_at": dt.date.today().isoformat(), "provider": "pinned"})

    if not members:
        raise ValueError("Auto-universe materialization produced no symbols after filtering.")

    symbols = [member["symbol"] for member in members]
    version_id = f"{universe_id}:{result.source_asof}:{_filter_definition_hash(request)}"
    manifest = {
        "id": universe_id,
        "version_id": version_id,
        "kind": "auto",
        "description": request.description,
        "benchmark": request.benchmark.strip().upper(),
        "source": result.provider,
        "source_asof": result.source_asof,
        "source_documents": result.source_documents,
        "last_reviewed_at": dt.date.today().isoformat(),
        "member_count": len(members),
        "filter_definition_hash": _filter_definition_hash(request),
        "filters": {**result.filters, "auto_filters": request.filters.__dict__},
        "symbols": symbols,
        "members": members,
        "taxonomy": result.taxonomy,
        "notes": result.notes,
    }

    changed = True
    if apply:
        store = load_auto_universe_store()
        current = store["universes"].get(universe_id)
        changed = current != manifest
        store["universes"][universe_id] = manifest
        store["symbol_registry"].update(registry_updates)
        _write_auto_universe_store(store)
    else:
        store = load_auto_universe_store()
        current = store["universes"].get(universe_id)
        changed = current != manifest

    return {"universe": manifest, "applied": apply, "changed": changed, "notes": result.notes}


def list_auto_universe_entries() -> list[dict]:
    store = load_auto_universe_store()
    entries = []
    for item in store.get("universes", {}).values():
        entries.append(
            {
                "id": item.get("id"),
                "kind": "auto",
                "description": item.get("description"),
                "benchmark": item.get("benchmark"),
                "source": item.get("source"),
                "source_asof": item.get("source_asof"),
                "last_reviewed_at": item.get("last_reviewed_at"),
                "member_count": item.get("member_count", len(item.get("symbols") or [])),
                "currencies": sorted({str(m.get("currency")).upper() for m in item.get("members", []) if m.get("currency")}),
                "exchange_mics": sorted({str(m.get("exchange_mic")).upper() for m in item.get("members", []) if m.get("exchange_mic")}),
                "source_adapter": "auto_universe",
                "source_documents": item.get("source_documents", []),
                "refreshable": True,
                "freshness_status": "fresh",
                "is_stale": False,
            }
        )
    return sorted(entries, key=lambda item: str(item.get("id", "")))


def get_auto_universe_detail(universe_id: str) -> dict | None:
    item = load_auto_universe_store().get("universes", {}).get(_slug(universe_id))
    if not item:
        return None
    return {**item, "constituents": item.get("members", [])}


def list_auto_universes() -> list[str]:
    return sorted(load_auto_universe_store().get("universes", {}).keys())


def load_auto_universe_symbols(universe_id: str) -> list[str]:
    item = get_auto_universe_detail(universe_id)
    if not item:
        raise ValueError(f"Unknown auto universe id: '{universe_id}'")
    return normalize_tickers(item.get("symbols") or [m.get("symbol") for m in item.get("members", [])])


def get_auto_universe_benchmark(universe_id: str) -> str | None:
    item = get_auto_universe_detail(universe_id)
    benchmark = (item or {}).get("benchmark")
    return str(benchmark).strip().upper() if benchmark else None
