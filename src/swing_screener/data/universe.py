from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional
import csv
import re

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
    name = str(name).strip().lower()
    if not name:
        raise ValueError("Universe name is empty.")

    rel = f"universes/{name}.csv"
    pkg = "swing_screener.data"

    try:
        data = importlib_resources.files(pkg).joinpath(rel).read_text(encoding="utf-8")
    except FileNotFoundError as e:
        raise FileNotFoundError(
            f"Universe '{name}' not found. Expected package file: {pkg}/{rel}"
        ) from e

    tickers = normalize_tickers(_read_csv_lines(data))
    tickers = apply_universe_config(tickers, cfg)
    return tickers


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
