from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import re
import time
import uuid
from pathlib import Path

import pandas as pd

from swing_screener.strategy.report_config import ReportConfig

logger = logging.getLogger(__name__)


def strategy_signature(cfg: ReportConfig) -> str:
    """Stable short hash of the config that affects per-symbol features.

    Only ``universe``, ``signals`` and ``risk`` participate. Ranking weights,
    ``top_n``, ``only_active_signals`` and ``strategy_module`` are excluded so
    that changing them still reuses cached per-symbol features.
    """
    payload = {
        "universe": dataclasses.asdict(cfg.universe),
        "signals": dataclasses.asdict(cfg.signals),
        "risk": dataclasses.asdict(cfg.risk),
    }
    blob = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()[:12]


def _safe_symbol(symbol: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", symbol)
    if safe != symbol:
        safe = f"{safe}__{hashlib.sha1(symbol.encode('utf-8')).hexdigest()[:8]}"
    return safe


class EvalCache:
    """Per-symbol parquet cache of deterministic screener evaluation rows."""

    def __init__(self, root: str | Path = ".cache/eval"):
        self.root = Path(root)

    def _dir(self, asof: str, sig: str) -> Path:
        return self.root / sig / asof

    def _path(self, ticker: str, asof: str, sig: str) -> Path:
        return self._dir(asof, sig) / f"{_safe_symbol(ticker.upper())}.parquet"

    def split(self, tickers: list[str], asof: str, sig: str) -> tuple[pd.DataFrame, list[str]]:
        frames: list[pd.DataFrame] = []
        misses: list[str] = []
        for raw in tickers:
            ticker = str(raw).strip().upper()
            if not ticker:
                continue
            path = self._path(ticker, asof, sig)
            if not path.exists():
                misses.append(ticker)
                continue
            try:
                frames.append(pd.read_parquet(path))
            except Exception as exc:
                logger.warning("Invalid eval cache at %s: %s", path, exc)
                path.unlink(missing_ok=True)
                misses.append(ticker)
        hits = pd.concat(frames) if frames else pd.DataFrame()
        return hits, misses

    def write(self, records: pd.DataFrame, asof: str, sig: str) -> None:
        if records is None or records.empty:
            return
        target = self._dir(asof, sig)
        target.mkdir(parents=True, exist_ok=True)
        index_name = records.index.name or "ticker"
        for ticker in records.index:
            frame = records.loc[[ticker]]
            frame.index.name = index_name
            path = self._path(str(ticker), asof, sig)
            tmp = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex}")
            try:
                frame.to_parquet(tmp)
                tmp.replace(path)
            except Exception as exc:
                logger.warning("Failed writing eval cache %s: %s", path, exc)
                tmp.unlink(missing_ok=True)

    def prune(self, max_age_sec: float = 24 * 3600) -> None:
        """Delete eval parquet files older than max_age_sec; drop empty dirs."""
        if not self.root.exists():
            return
        cutoff = time.time() - max_age_sec
        for path in self.root.rglob("*.parquet"):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
            except OSError as exc:
                logger.debug("Prune skip %s: %s", path, exc)
        for sub in sorted(self.root.rglob("*"), reverse=True):
            if sub.is_dir() and not any(sub.iterdir()):
                sub.rmdir()
