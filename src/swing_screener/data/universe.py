from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable, Optional, Sequence
import csv
import json
import re
from pathlib import Path

try:
    # py>=3.9
    from importlib import resources as importlib_resources
except Exception:  # pragma: no cover
    import importlib_resources  # type: ignore


_TICKER_RE = re.compile(r"^[A-Z0-9.\-]+$")


@dataclass(frozen=True)
class UniverseConfig:
    benchmark: str = "SPY"
    ensure_benchmark: bool = True
    max_tickers: Optional[int] = None  # optional cap after loading


def normalize_tickers(items: Iterable[str]) -> list[str]:
    out: list[str] = []
    for raw in items:
        t = str(raw).strip().upper()
        if not t:
            continue
        # allow comments like "AAPL  # apple"
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


def list_package_universes() -> list[str]:
    """
    Return available packaged universes.
    If a manifest is present, use it to determine the public names.
    """
    manifest = _manifest_universes()
    names: list[str] = []
    for entry in manifest:
        if entry.get("deprecated"):
            continue
        name = str(entry.get("name", "")).strip()
        if name and name not in names:
            names.append(name)

    # Also include any CSVs not referenced in the manifest
    pkg = "swing_screener.data"
    base = importlib_resources.files(pkg).joinpath("universes")
    manifest_names = {str(e.get("name", "")).strip().lower() for e in manifest}
    manifest_aliases = _manifest_aliases()
    for p in base.iterdir():
        if p.suffix != ".csv":
            continue
        stem = p.stem
        key = stem.lower()
        if key in manifest_names or key in manifest_aliases:
            continue
        names.append(stem)

    return sorted(names)


def _read_csv_lines(text: str) -> list[str]:
    # Accept both "one per line" and comma-separated
    lines = [ln.strip() for ln in text.splitlines()]
    raw_items: list[str] = []
    for ln in lines:
        if not ln or ln.lstrip().startswith("#"):
            continue
        # if commas exist, split; otherwise treat as single token
        if "," in ln:
            raw_items.extend([x.strip() for x in ln.split(",")])
        else:
            raw_items.append(ln)
    return raw_items


def load_universe_from_package(
    name: str, cfg: UniverseConfig = UniverseConfig()
) -> list[str]:
    """
    Load universe tickers from package data:
      swing_screener/data/universes/<name>.csv
    """
    raw_name = str(name).strip()
    if not raw_name:
        raise ValueError("Universe name is empty.")

    canonical = resolve_universe_name(raw_name)
    filename = resolve_universe_filename(raw_name)
    rel = f"universes/{filename}"
    pkg = "swing_screener.data"

    try:
        data = importlib_resources.files(pkg).joinpath(rel).read_text(encoding="utf-8")
    except FileNotFoundError as e:
        raise FileNotFoundError(
            f"Universe '{raw_name}' not found. Expected package file: {pkg}/{rel}"
        ) from e

    tickers = normalize_tickers(_read_csv_lines(data))
    tickers = apply_universe_config(tickers, cfg)
    return tickers


def resolve_universe_name(name: str) -> str:
    key = str(name).strip().lower()
    if not key:
        raise ValueError("Universe name is empty.")
    by_name = _manifest_by_name()
    if key in by_name:
        return by_name[key]["name"]
    aliases = _manifest_aliases()
    if key in aliases:
        return aliases[key]
    return key


def resolve_universe_filename(name: str) -> str:
    meta = get_universe_meta(name)
    if meta:
        file = meta.get("file")
        if file:
            return str(file)
    canonical = resolve_universe_name(name)
    return f"{canonical}.csv"


def get_universe_meta(name: str) -> Optional[dict]:
    key = str(name).strip().lower()
    if not key:
        return None
    by_name = _manifest_by_name()
    if key in by_name:
        return by_name[key]
    aliases = _manifest_aliases()
    if key in aliases:
        return by_name.get(aliases[key])
    return None


def get_universe_benchmark(name: str) -> Optional[str]:
    meta = get_universe_meta(name)
    if not meta:
        return None
    bench = meta.get("benchmark")
    if bench:
        return str(bench).strip().upper()
    return None


def get_universe_package_path(name: str) -> Path:
    pkg = "swing_screener.data"
    filename = resolve_universe_filename(name)
    return importlib_resources.files(pkg).joinpath(f"universes/{filename}").resolve()


@lru_cache
def _load_manifest() -> dict:
    pkg = "swing_screener.data"
    rel = "universes/manifest.json"
    try:
        data = importlib_resources.files(pkg).joinpath(rel).read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    try:
        return json.loads(data)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid universe manifest JSON: {rel}") from exc


def _manifest_universes() -> list[dict]:
    data = _load_manifest()
    entries = data.get("universes", [])
    if not isinstance(entries, list):
        return []
    out: list[dict] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name", "")).strip()
        if name:
            entry = dict(entry)
            entry["name"] = name.lower()
            out.append(entry)
    return out


@lru_cache
def _manifest_by_name() -> dict[str, dict]:
    entries = _manifest_universes()
    return {e["name"]: e for e in entries}


@lru_cache
def _manifest_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for entry in _manifest_universes():
        name = entry["name"]
        for alias in entry.get("aliases", []) or []:
            key = str(alias).strip().lower()
            if key:
                aliases[key] = name
    return aliases


def load_universe_from_file(
    path: str, cfg: UniverseConfig = UniverseConfig()
) -> list[str]:
    """
    Load universe tickers from a user-provided file.
    Supports:
      - one ticker per line
      - CSV with ticker in first column
      - comma-separated lines
    """
    p = str(path)
    with open(p, "r", encoding="utf-8") as f:
        text = f.read()

    # First try simple line parsing (covers most cases)
    items = _read_csv_lines(text)

    # If it looks like a structured CSV, also parse first column
    # (harmless if not a structured CSV)
    try:
        reader = csv.reader(text.splitlines())
        for row in reader:
            if row:
                items.append(row[0])
    except Exception:
        pass

    tickers = normalize_tickers(items)
    tickers = apply_universe_config(tickers, cfg)
    return tickers


def apply_universe_config(tickers: list[str], cfg: UniverseConfig) -> list[str]:
    out = tickers[:]
    if cfg.ensure_benchmark:
        b = cfg.benchmark.strip().upper()
        if b and b not in out:
            out.append(b)

    if cfg.max_tickers is not None:
        if cfg.max_tickers <= 0:
            raise ValueError("max_tickers must be positive.")
        # keep order, cap length
        out = out[: cfg.max_tickers]

        # if capped, ensure benchmark still included
        if cfg.ensure_benchmark:
            b = cfg.benchmark.strip().upper()
            if b and b not in out:
                # replace last item with benchmark
                out[-1] = b

    return out


def filter_ticker_list(
    tickers: Sequence[str],
    include: Optional[Sequence[str]] = None,
    exclude: Optional[Sequence[str]] = None,
    grep: Optional[str] = None,
) -> list[str]:
    """
    Apply simple include/exclude/substring filters to a ticker list.
    - include/exclude are literal tickers (validated).
    - grep keeps tickers containing the substring (case-insensitive).
    """
    base = [str(t).strip().upper() for t in tickers if str(t).strip()]

    if grep:
        g = str(grep).strip().upper()
        base = [t for t in base if g in t]

    if exclude:
        excl = set(normalize_tickers(exclude))
    else:
        excl = set()

    if include:
        inc = normalize_tickers(include)
    else:
        inc = []

    out: list[str] = []
    for t in base + inc:
        if t in excl:
            continue
        if t not in out:
            out.append(t)

    if not out:
        raise ValueError("No tickers left after filtering.")
    return out


def save_universe_file(tickers: Sequence[str], path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join([t for t in tickers])
    path.write_text(content + "\n", encoding="utf-8")
    return path
