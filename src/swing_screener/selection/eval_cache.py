from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import re
import time
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from swing_screener.strategy.report_config import ReportConfig

logger = logging.getLogger(__name__)

EVALUATION_CACHE_SCHEMA_VERSION = 2
_META_PREFIX = "__eval_cache_"
_META_COLUMNS = {
    "schema_version": f"{_META_PREFIX}schema_version__",
    "asof": f"{_META_PREFIX}asof__",
    "last_bar": f"{_META_PREFIX}last_bar__",
    "market_phase": f"{_META_PREFIX}market_phase__",
    "strategy_signature": f"{_META_PREFIX}strategy_signature__",
    "input_fingerprint": f"{_META_PREFIX}input_fingerprint__",
}


@dataclass(frozen=True)
class EvaluationCacheIdentity:
    """Immutable provenance required for an evaluation-cache hit."""

    schema_version: int
    asof: str
    last_bar: str
    market_phase: str
    strategy_signature: str
    input_fingerprint: str


def _iso_timestamp(value) -> str:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize("UTC")
    else:
        timestamp = timestamp.tz_convert("UTC")
    return timestamp.isoformat()


def _normalize_benchmark_momentum(value: float | None) -> float | None:
    """Normalize the consumed benchmark momentum return for fingerprinting.

    ``None`` covers missing, NaN, or non-computable benchmark momentum so that
    an unavailable benchmark fingerprints identically regardless of how the
    absence was expressed.
    """
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def resolve_benchmark_momentum_6m(
    ohlcv: pd.DataFrame,
    benchmark: str,
    lookback_6m: int,
) -> float | None:
    """Return the exact 6-month benchmark return consumed by ``rs_6m``.

    Mirrors :func:`swing_screener.indicators.momentum.compute_returns` for the
    single benchmark ticker (per-ticker ``dropna``, ``last / prev - 1`` over
    ``lookback_6m`` bars). Call once per report build and share the result
    across every symbol identity so the full benchmark OHLCV is never hashed
    per ticker. Returns ``None`` when the benchmark input is unavailable,
    exactly matching the cases where momentum evaluation cannot compute it.
    """
    try:
        benchmark_key = str(benchmark).strip()
    except Exception:
        return None
    if not benchmark_key:
        return None
    try:
        lookback = int(lookback_6m)
    except (TypeError, ValueError):
        return None
    if lookback <= 1:
        return None
    if ohlcv is None or getattr(ohlcv, "empty", True):
        return None
    try:
        if not isinstance(ohlcv.columns, pd.MultiIndex):
            return None
        if "Close" not in set(ohlcv.columns.get_level_values(0)):
            return None
        close = ohlcv["Close"]
    except Exception:
        return None
    try:
        if isinstance(close, pd.Series):
            if str(close.name) != benchmark_key:
                return None
            series = close.dropna()
        else:
            if benchmark_key not in close.columns:
                return None
            series = close[benchmark_key].dropna()
        if len(series) < lookback + 1:
            return None
        last_val = series.iloc[-1]
        prev_val = series.iloc[-(lookback + 1)]
        if pd.isna(last_val) or pd.isna(prev_val) or prev_val == 0:
            return None
        return float(last_val / prev_val - 1.0)
    except Exception:
        return None


def _symbol_input_fingerprint(
    ohlcv: pd.DataFrame,
    ticker: str,
    sector_benchmark_return: float | None,
    benchmark_momentum_6m: float | None = None,
) -> tuple[str, str]:
    columns = [column for column in ohlcv.columns if str(column[1]).upper() == ticker]
    frame = ohlcv.loc[:, columns].dropna(how="all")
    last_bar = _iso_timestamp(frame.index.max()) if not frame.empty else ""
    digest = hashlib.sha256()
    digest.update(
        json.dumps(
            [tuple(map(str, column)) for column in columns], separators=(",", ":")
        ).encode("utf-8")
    )
    digest.update(pd.util.hash_pandas_object(frame, index=True).values.tobytes())
    digest.update(
        json.dumps(
            {
                "sector_benchmark_return": sector_benchmark_return,
                "benchmark_momentum_6m": _normalize_benchmark_momentum(
                    benchmark_momentum_6m
                ),
            },
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    )
    return last_bar, digest.hexdigest()


def build_evaluation_cache_identities(
    ohlcv: pd.DataFrame,
    tickers: Sequence[str],
    *,
    asof: str,
    market_phase: str,
    strategy_signature: str,
    sector_benchmark_returns: Mapping[str, float] | None = None,
    benchmark_momentum_6m: float | None = None,
) -> dict[str, EvaluationCacheIdentity]:
    """Build deterministic per-symbol identities from all evaluation inputs."""

    normalized_sector_returns = {
        str(key).strip().upper(): float(value) if pd.notna(value) else None
        for key, value in (sector_benchmark_returns or {}).items()
    }
    normalized_benchmark = _normalize_benchmark_momentum(benchmark_momentum_6m)
    identities: dict[str, EvaluationCacheIdentity] = {}
    for raw_ticker in tickers:
        ticker = str(raw_ticker).strip().upper()
        if not ticker:
            continue
        last_bar, fingerprint = _symbol_input_fingerprint(
            ohlcv,
            ticker,
            normalized_sector_returns.get(ticker),
            normalized_benchmark,
        )
        identities[ticker] = EvaluationCacheIdentity(
            schema_version=EVALUATION_CACHE_SCHEMA_VERSION,
            asof=asof,
            last_bar=last_bar,
            market_phase=market_phase,
            strategy_signature=strategy_signature,
            input_fingerprint=fingerprint,
        )
    return identities


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

    def __init__(
        self, root: str | Path = ".cache/eval", *, writes_enabled: bool = True
    ):
        self.root = Path(root)
        self.writes_enabled = writes_enabled

    def read_only(self) -> "EvalCache":
        """Return a cache view that permits reads but suppresses mutations."""
        return EvalCache(self.root, writes_enabled=False)

    def _dir(self, asof: str, sig: str) -> Path:
        return self.root / sig / asof

    def _path(self, ticker: str, asof: str, sig: str) -> Path:
        return self._dir(asof, sig) / f"{_safe_symbol(ticker.upper())}.parquet"

    def split(
        self,
        tickers: list[str],
        *,
        identities: Mapping[str, EvaluationCacheIdentity],
    ) -> tuple[pd.DataFrame, list[str]]:
        frames: list[pd.DataFrame] = []
        misses: list[str] = []
        for raw in tickers:
            ticker = str(raw).strip().upper()
            if not ticker:
                continue
            identity = identities.get(ticker)
            if identity is None:
                misses.append(ticker)
                continue
            path = self._path(ticker, identity.asof, identity.strategy_signature)
            if not path.exists():
                misses.append(ticker)
                continue
            try:
                frame = pd.read_parquet(path)
                if len(frame) != 1:
                    misses.append(ticker)
                    continue
                try:
                    cached_ticker = str(frame.index[0]).strip().upper()
                except Exception:
                    misses.append(ticker)
                    continue
                if cached_ticker != ticker:
                    misses.append(ticker)
                    continue
                expected = dataclasses.asdict(identity)
                if any(
                    column not in frame.columns
                    or frame.empty
                    or str(frame[column].iloc[0]) != str(expected[field])
                    for field, column in _META_COLUMNS.items()
                ):
                    misses.append(ticker)
                    continue
                frames.append(frame.drop(columns=list(_META_COLUMNS.values())))
            except Exception as exc:
                logger.warning("Invalid eval cache at %s: %s", path, exc)
                if self.writes_enabled:
                    path.unlink(missing_ok=True)
                misses.append(ticker)
        hits = pd.concat(frames) if frames else pd.DataFrame()
        return hits, misses

    def write(
        self,
        records: pd.DataFrame,
        *,
        identities: Mapping[str, EvaluationCacheIdentity],
    ) -> None:
        if not self.writes_enabled or records is None or records.empty:
            return
        index_name = records.index.name or "ticker"
        for ticker in records.index:
            normalized_ticker = str(ticker).strip().upper()
            identity = identities.get(normalized_ticker)
            if identity is None:
                logger.warning("Missing eval cache identity for %s", normalized_ticker)
                continue
            target = self._dir(identity.asof, identity.strategy_signature)
            target.mkdir(parents=True, exist_ok=True)
            frame = records.loc[[ticker]]
            frame.index.name = index_name
            for field, column in _META_COLUMNS.items():
                frame[column] = getattr(identity, field)
            path = self._path(
                normalized_ticker, identity.asof, identity.strategy_signature
            )
            tmp = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex}")
            try:
                frame.to_parquet(tmp)
                tmp.replace(path)
            except Exception as exc:
                logger.warning("Failed writing eval cache %s: %s", path, exc)
                tmp.unlink(missing_ok=True)

    def prune(self, max_age_sec: float = 24 * 3600) -> None:
        """Delete eval parquet files older than max_age_sec; drop empty dirs."""
        if not self.writes_enabled:
            return
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
