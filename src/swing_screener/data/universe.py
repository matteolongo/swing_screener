from __future__ import annotations

import datetime
import json
import re
import warnings
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable, Optional, Sequence

try:
    from importlib import resources as importlib_resources
except Exception:  # pragma: no cover
    import importlib_resources  # type: ignore


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
