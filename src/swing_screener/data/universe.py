from __future__ import annotations

import datetime
import json
import re
import warnings
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Optional, Sequence

try:
    from importlib import resources as importlib_resources
except Exception:  # pragma: no cover
    import importlib_resources  # type: ignore

from swing_screener.data.universe_sources import refresh_snapshot_from_source


_TICKER_RE = re.compile(r"^[A-Z0-9.\-]+$")
_REGISTRY_PKG = "swing_screener.data"
_REGISTRY_REL = "universes/registry"


@dataclass(frozen=True)
class UniverseConfig:
    benchmark: str = "SPY"
    ensure_benchmark: bool = True
    max_tickers: Optional[int] = None


def normalize_tickers(items: Iterable[str]) -> list[str]:
    out: list[str] = []
    for raw in items:
        t = str(raw).strip().upper()
        if not t:
            continue
        if "#" in t:
            t = t.split("#", 1)[0].strip()
        if not t:
            continue
        if not _TICKER_RE.match(t):
            raise ValueError(f"Invalid ticker '{t}'. Allowed: A-Z 0-9 . -")
        if t not in out:
            out.append(t)
    if not out:
        raise ValueError("Universe is empty after normalization.")
    return out


def apply_universe_config(tickers: list[str], cfg: UniverseConfig) -> list[str]:
    out = tickers[:]
    if cfg.ensure_benchmark:
        b = cfg.benchmark.strip().upper()
        if b and b not in out:
            out.append(b)
    if cfg.max_tickers is not None:
        if cfg.max_tickers <= 0:
            raise ValueError("max_tickers must be positive.")
        out = out[: cfg.max_tickers]
        if cfg.ensure_benchmark:
            b = cfg.benchmark.strip().upper()
            if b and b not in out:
                out[-1] = b
    return out


def filter_ticker_list(
    tickers: Sequence[str],
    include: Optional[Sequence[str]] = None,
    exclude: Optional[Sequence[str]] = None,
    grep: Optional[str] = None,
) -> list[str]:
    base = [str(t).strip().upper() for t in tickers if str(t).strip()]
    if grep:
        g = str(grep).strip().upper()
        base = [t for t in base if g in t]
    excl = set(normalize_tickers(exclude)) if exclude else set()
    inc = normalize_tickers(include) if include else []
    out: list[str] = []
    for t in base + inc:
        if t in excl:
            continue
        if t not in out:
            out.append(t)
    if not out:
        raise ValueError("No tickers left after filtering.")
    return out


@lru_cache(maxsize=1)
def _load_registry_manifest() -> list[dict]:
    rel = f"{_REGISTRY_REL}/manifest.json"
    try:
        data = importlib_resources.files(_REGISTRY_PKG).joinpath(rel).read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise FileNotFoundError(
            f"Universe registry manifest not found: {_REGISTRY_PKG}/{rel}"
        ) from exc
    try:
        result = json.loads(data)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid registry manifest JSON: {rel}") from exc
    if not isinstance(result, list):
        raise ValueError(f"Registry manifest must be a JSON array: {rel}")
    return result


@lru_cache(maxsize=64)
def _load_snapshot(universe_id: str) -> dict:
    rel = f"{_REGISTRY_REL}/snapshots/{universe_id}.json"
    try:
        data = importlib_resources.files(_REGISTRY_PKG).joinpath(rel).read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise FileNotFoundError(
            f"Snapshot not found for universe '{universe_id}': {_REGISTRY_PKG}/{rel}"
        ) from exc
    try:
        return json.loads(data)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid snapshot JSON for universe '{universe_id}'") from exc


def _registry_root_path() -> Path:
    return Path(__file__).resolve().parent / "universes" / "registry"


def _snapshot_path(universe_id: str) -> Path:
    return _registry_root_path() / "snapshots" / f"{universe_id}.json"


def _write_snapshot(universe_id: str, snapshot: dict) -> None:
    path = _snapshot_path(universe_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    _load_snapshot.cache_clear()


def _freshness_payload(snapshot: dict) -> dict:
    last_reviewed = snapshot.get("last_reviewed_at")
    stale_after = snapshot.get("stale_after_days")
    try:
        reviewed_date = datetime.date.fromisoformat(str(last_reviewed))
    except (TypeError, ValueError):
        return {
            "days_since_review": None,
            "freshness_status": "unknown",
            "is_stale": False,
        }

    days_since_review = max((datetime.date.today() - reviewed_date).days, 0)
    if not stale_after:
        return {
            "days_since_review": days_since_review,
            "freshness_status": "fresh",
            "is_stale": False,
        }
    if days_since_review > stale_after:
        return {
            "days_since_review": days_since_review,
            "freshness_status": "stale",
            "is_stale": True,
        }
    if days_since_review >= max(int(stale_after * 0.8), 1):
        return {
            "days_since_review": days_since_review,
            "freshness_status": "review_due",
            "is_stale": False,
        }
    return {
        "days_since_review": days_since_review,
        "freshness_status": "fresh",
        "is_stale": False,
    }


def _check_stale(snapshot: dict) -> None:
    uid = snapshot.get("id", "?")
    kind = snapshot.get("kind", "curated")
    last_reviewed = snapshot.get("last_reviewed_at")
    stale_after = snapshot.get("stale_after_days")
    if not last_reviewed or not stale_after:
        return
    try:
        reviewed_date = datetime.date.fromisoformat(str(last_reviewed))
    except ValueError:
        return
    age_days = (datetime.date.today() - reviewed_date).days
    if age_days > stale_after:
        msg = (
            f"Universe '{uid}' is stale: last reviewed {last_reviewed} "
            f"({age_days} days ago, limit {stale_after} days)."
        )
        if kind == "index":
            raise RuntimeError(msg + " Index universes must be updated before use.")
        else:
            warnings.warn(msg + " Curated universe loaded with stale data.", UserWarning, stacklevel=4)


def _load_instrument_master() -> dict[str, dict]:
    """Return instrument master as symbol → record dict, cached."""
    return _instrument_master_cache()


@lru_cache(maxsize=1)
def _instrument_master_cache() -> dict[str, dict]:
    import os
    # Try project-relative path first (works in dev), then package data
    for candidate in [
        "data/intelligence/instrument_master.json",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "intelligence", "instrument_master.json"),
    ]:
        p = os.path.abspath(candidate)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                records = json.load(f)
            return {r["symbol"]: r for r in records}
    return {}


def validate_universe_snapshot(universe_id: str) -> list[str]:
    """Validate a snapshot against instrument master and rules. Returns list of error strings."""
    snapshot = _load_snapshot(universe_id)
    master = _load_instrument_master()
    errors: list[str] = []
    rules = snapshot.get("rules", {})
    allowed_mics: list[str] = rules.get("exchange_mics", [])
    allowed_currencies: list[str] = rules.get("currencies", [])
    for c in snapshot.get("constituents", []):
        sym = c["symbol"]
        if master and sym not in master:
            errors.append(f"[{universe_id}] {sym}: not in instrument master")
            continue
        if master and sym in master:
            rec = master[sym]
            if allowed_mics and rec.get("exchange_mic") not in allowed_mics:
                errors.append(
                    f"[{universe_id}] {sym}: exchange_mic '{rec.get('exchange_mic')}' "
                    f"not in allowed {allowed_mics}"
                )
            if allowed_currencies and rec.get("currency") not in allowed_currencies:
                errors.append(
                    f"[{universe_id}] {sym}: currency '{rec.get('currency')}' "
                    f"not in allowed {allowed_currencies}"
                )
    return errors


def get_instrument_record(symbol: str) -> Optional[dict]:
    """Return instrument-master metadata for a symbol when available."""
    if not symbol:
        return None
    return _load_instrument_master().get(str(symbol).strip().upper())


def _summary_from_entry(entry: dict, snapshot: dict) -> dict:
    constituents = snapshot.get("constituents", [])
    item = dict(entry)
    for key in ("description", "benchmark", "source", "source_asof", "last_reviewed_at", "stale_after_days", "kind"):
        if key in snapshot and snapshot.get(key) not in (None, ""):
            item[key] = snapshot.get(key)
    item["member_count"] = len(constituents)
    item["currencies"] = sorted({str(c.get("currency", "")).upper() for c in constituents if c.get("currency")})
    item["exchange_mics"] = sorted({str(c.get("exchange_mic", "")).upper() for c in constituents if c.get("exchange_mic")})
    item["source_adapter"] = str(snapshot.get("source_adapter") or "manual_snapshot")
    item["source_documents"] = list(snapshot.get("source_documents") or [])
    item["refreshable"] = item["source_adapter"] != "manual_snapshot"
    item.update(_freshness_payload(snapshot))
    return item


def list_package_universe_entries() -> list[dict]:
    """Return manifest entries enriched with lightweight snapshot metadata."""
    entries = []
    for entry in _load_registry_manifest():
        snapshot = _load_snapshot(entry["id"])
        item = _summary_from_entry(entry, snapshot)
        entries.append(item)
    return sorted(entries, key=lambda item: str(item.get("id", "")))


def get_package_universe_entry(universe_id: str) -> dict:
    entry = get_universe_meta(universe_id)
    if not entry:
        raise ValueError(f"Unknown universe id: '{universe_id}'")
    snapshot = _load_snapshot(universe_id)
    return _summary_from_entry(entry, snapshot)


def get_package_universe_detail(universe_id: str) -> dict:
    entry = get_package_universe_entry(universe_id)
    snapshot = _load_snapshot(universe_id)
    errors = validate_universe_snapshot(universe_id)
    constituents: list[dict] = []
    for item in snapshot.get("constituents", []):
        rec = get_instrument_record(item.get("symbol", "")) or {}
        yahoo_symbol = str((rec.get("provider_symbol_map") or {}).get("yahoo_finance") or item.get("symbol") or "")
        constituents.append(
            {
                "symbol": item.get("symbol"),
                "source_name": item.get("source_name"),
                "source_symbol": item.get("source_symbol") or yahoo_symbol.split(".")[0],
                "exchange_mic": item.get("exchange_mic") or rec.get("exchange_mic"),
                "currency": item.get("currency") or rec.get("currency"),
                "instrument_type": rec.get("instrument_type"),
                "status": rec.get("status"),
                "primary_listing": rec.get("primary_listing"),
            }
        )
    return {
        **entry,
        "rules": snapshot.get("rules", {}),
        "validation_errors": errors,
        "constituents": constituents,
    }


def refresh_package_universe(universe_id: str, *, apply: bool = False) -> dict:
    entry = get_universe_meta(universe_id)
    if not entry:
        raise ValueError(f"Unknown universe id: '{universe_id}'")
    current_snapshot = _load_snapshot(universe_id)
    instrument_master = _load_instrument_master()
    preview = refresh_snapshot_from_source(universe_id, current_snapshot, instrument_master)
    proposed_snapshot = json.loads(json.dumps(current_snapshot))
    proposed_snapshot["constituents"] = preview.constituents
    proposed_snapshot["source_asof"] = preview.source_asof
    proposed_snapshot["source_adapter"] = preview.source_adapter
    proposed_snapshot["source_documents"] = preview.source_documents
    proposed_snapshot["last_reviewed_at"] = datetime.date.today().isoformat()
    rules = dict(proposed_snapshot.get("rules") or {})
    exchange_mics = sorted(
        {
            str(item.get("exchange_mic", "")).upper()
            for item in preview.constituents
            if item.get("exchange_mic")
        }
    )
    currencies = sorted(
        {
            str(item.get("currency", "")).upper()
            for item in preview.constituents
            if item.get("currency")
        }
    )
    if exchange_mics:
        rules["exchange_mics"] = exchange_mics
    if currencies:
        rules["currencies"] = currencies
    proposed_snapshot["rules"] = rules

    current_symbols = [str(item.get("symbol", "")).upper() for item in current_snapshot.get("constituents", [])]
    proposed_symbols = [str(item.get("symbol", "")).upper() for item in proposed_snapshot.get("constituents", [])]
    current_set = set(current_symbols)
    proposed_set = set(proposed_symbols)
    additions = [symbol for symbol in proposed_symbols if symbol not in current_set]
    removals = [symbol for symbol in current_symbols if symbol not in proposed_set]
    changed = current_symbols != proposed_symbols

    if apply and changed:
        _write_snapshot(universe_id, proposed_snapshot)
        current_snapshot = proposed_snapshot

    summary = _summary_from_entry(entry, current_snapshot if apply and changed else proposed_snapshot)
    return {
        "universe": summary,
        "applied": apply and changed,
        "changed": changed,
        "current_member_count": len(current_symbols),
        "proposed_member_count": len(proposed_symbols),
        "additions": additions,
        "removals": removals,
        "notes": list(preview.notes),
    }


def filter_tickers_by_metadata(
    tickers: Sequence[str],
    *,
    currencies: Optional[Sequence[str]] = None,
    exchange_mics: Optional[Sequence[str]] = None,
    include_otc: Optional[bool] = None,
    instrument_types: Optional[Sequence[str]] = None,
) -> list[str]:
    """
    Filter tickers using instrument-master metadata.

    Unknown metadata is only tolerated when no corresponding filter is requested.
    """
    allowed_currencies = {str(c).strip().upper() for c in (currencies or []) if str(c).strip()}
    allowed_exchanges = {str(m).strip().upper() for m in (exchange_mics or []) if str(m).strip()}
    allowed_types = {str(t).strip().lower() for t in (instrument_types or []) if str(t).strip()}

    out: list[str] = []
    for raw in tickers:
        symbol = str(raw).strip().upper()
        if not symbol:
            continue
        rec = get_instrument_record(symbol)
        currency = str((rec or {}).get("currency") or "").strip().upper() or "UNKNOWN"
        exchange = str((rec or {}).get("exchange_mic") or "").strip().upper() or "UNKNOWN"
        instrument_type = str((rec or {}).get("instrument_type") or "unknown").strip().lower()

        if allowed_currencies and currency not in allowed_currencies:
            continue
        if allowed_exchanges and exchange not in allowed_exchanges:
            continue
        if include_otc is False and exchange == "XOTC":
            continue
        if allowed_types and instrument_type not in allowed_types:
            continue
        if symbol not in out:
            out.append(symbol)
    return out


def list_package_universes() -> list[str]:
    """Return universe ids from registry manifest, sorted."""
    return sorted(e["id"] for e in _load_registry_manifest())


def load_universe_from_package(
    name: str, cfg: UniverseConfig = UniverseConfig()
) -> list[str]:
    """Load tickers from a registry snapshot. Fails on unknown id or stale index."""
    manifest_ids = {e["id"] for e in _load_registry_manifest()}
    if name not in manifest_ids:
        raise ValueError(
            f"Unknown universe id: '{name}'. Available: {sorted(manifest_ids)}"
        )
    snapshot = _load_snapshot(name)
    _check_stale(snapshot)
    tickers = [c["symbol"] for c in snapshot.get("constituents", [])]
    tickers = normalize_tickers(tickers)
    return apply_universe_config(tickers, cfg)


def get_universe_benchmark(name: str) -> Optional[str]:
    """Return benchmark from manifest entry."""
    for entry in _load_registry_manifest():
        if entry.get("id") == name:
            b = entry.get("benchmark")
            return str(b).strip().upper() if b else None
    return None


def get_universe_meta(name: str) -> Optional[dict]:
    """Return manifest entry for the given universe id."""
    for entry in _load_registry_manifest():
        if entry.get("id") == name:
            return entry
    return None


def load_universe_from_file(
    path: str, cfg: UniverseConfig = UniverseConfig()
) -> list[str]:
    """Load universe tickers from a user-provided file."""
    import csv as csv_mod

    p = str(path)
    with open(p, "r", encoding="utf-8") as f:
        text = f.read()

    lines = [ln.strip() for ln in text.splitlines()]
    raw_items: list[str] = []
    for ln in lines:
        if not ln or ln.lstrip().startswith("#"):
            continue
        if "," in ln:
            raw_items.extend([x.strip() for x in ln.split(",")])
        else:
            raw_items.append(ln)

    try:
        reader = csv_mod.reader(text.splitlines())
        for row in reader:
            if row:
                raw_items.append(row[0])
    except Exception:
        pass

    tickers = normalize_tickers(raw_items)
    tickers = apply_universe_config(tickers, cfg)
    return tickers
