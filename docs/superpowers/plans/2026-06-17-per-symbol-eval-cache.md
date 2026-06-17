# Per-Symbol Screener Evaluation Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache the deterministic per-symbol screener evaluation so a re-run (manual screen or daily-review) recomputes only symbols it has no fresh result for, sharing across mixed/overlapping universes.

**Architecture:** Split the momentum pipeline at the cross-sectional boundary. The universe-independent per-symbol stage (`build_feature_table` + `build_signal_board` + `compute_setup_quality`) becomes a single cacheable unit keyed by `(symbol, asof_date, strategy_sig)`, persisted as one parquet file per symbol under `.cache/eval/`. The cross-sectional stage (percentile `score`, `rank`, top-N, `confidence`, position sizing) is recomputed every run over the assembled feature table. `build_momentum_report` gains optional cache params and is backward-compatible when they are absent.

**Tech Stack:** Python, pandas, pyarrow/parquet, pytest. Base branch: `codex/implementare-soluzione-automatica-per-screener`. Spec: `docs/superpowers/specs/2026-06-17-per-symbol-eval-cache-design.md`.

---

## File Structure

- Create `src/swing_screener/selection/eval_cache.py` — `strategy_signature()` and `EvalCache` (split/write/prune, parquet I/O).
- Create `tests/test_eval_cache.py` — unit tests for both.
- Modify `src/swing_screener/strategy/modules/momentum.py` — extract `compute_symbol_records()`, restructure `build_momentum_report()` to consult the cache.
- Modify `src/swing_screener/strategy/orchestrator.py` and `src/swing_screener/reporting/report.py` — thread optional `eval_cache` / `asof_date` through `build_strategy_report` / `build_daily_report`.
- Modify `api/services/screener_service.py` — construct an `EvalCache`, pass it (and `asof`, force-refresh) into the report; align strategy resolution with the signature.
- Modify `api/models/screener.py` — add `force_refresh` to `ScreenerRequest`.
- Modify `tests/test_screener_service.py` — cache-hit / mixed-universe / force-refresh integration tests.
- Modify `config/README.md`, `src/swing_screener/data/README.md`, `src/swing_screener/data/OPTIMIZATION_GUIDE.md` — document the eval cache and retention.

---

## Task 1: Strategy signature helper

**Files:**
- Create: `src/swing_screener/selection/eval_cache.py`
- Test: `tests/test_eval_cache.py`

The signature must hash **only** config that changes per-symbol features (universe filters/vol, entry signals, risk stop params) and must **exclude** ranking weights, `top_n`, `only_active_signals`, and `strategy_module` (those affect cross-sectional ordering or display, not the cached per-symbol values).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_eval_cache.py
import dataclasses

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.selection.eval_cache import strategy_signature


def test_signature_is_stable_and_hex():
    cfg = ReportConfig()
    sig = strategy_signature(cfg)
    assert isinstance(sig, str)
    assert sig == strategy_signature(ReportConfig())  # deterministic
    assert all(c in "0123456789abcdef" for c in sig)


def test_signature_ignores_ranking_and_topn():
    base = ReportConfig()
    changed = dataclasses.replace(
        base, ranking=dataclasses.replace(base.ranking, top_n=base.ranking.top_n + 5)
    )
    assert strategy_signature(base) == strategy_signature(changed)


def test_signature_changes_with_signals():
    base = ReportConfig()
    changed = dataclasses.replace(
        base, signals=dataclasses.replace(base.signals, breakout_lookback=base.signals.breakout_lookback + 10)
    )
    assert strategy_signature(base) != strategy_signature(changed)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_eval_cache.py -q`
Expected: FAIL with `ModuleNotFoundError: swing_screener.selection.eval_cache`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/swing_screener/selection/eval_cache.py
from __future__ import annotations

import dataclasses
import hashlib
import json

from swing_screener.strategy.report_config import ReportConfig


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_eval_cache.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/selection/eval_cache.py tests/test_eval_cache.py
git commit -m "feat(eval-cache): strategy signature from per-symbol config"
```

---

## Task 2: EvalCache parquet store — split / write

**Files:**
- Modify: `src/swing_screener/selection/eval_cache.py`
- Test: `tests/test_eval_cache.py`

`split` returns the cached rows (as one DataFrame indexed by ticker) plus the list of misses. `write` persists each ticker's row to its own parquet atomically. Layout: `{root}/{sig}/{asof}/{SAFE_SYMBOL}.parquet`.

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_eval_cache.py
import pandas as pd
from swing_screener.selection.eval_cache import EvalCache


def _records(tickers):
    return pd.DataFrame(
        {"mom_6m": [1.0] * len(tickers), "is_eligible": [True] * len(tickers)},
        index=pd.Index([t.upper() for t in tickers], name="ticker"),
    )


def test_split_all_miss_when_empty(tmp_path):
    cache = EvalCache(root=tmp_path)
    hits, misses = cache.split(["AAPL", "MSFT"], asof="2026-06-16", sig="abc")
    assert hits.empty
    assert sorted(misses) == ["AAPL", "MSFT"]


def test_write_then_split_hits(tmp_path):
    cache = EvalCache(root=tmp_path)
    cache.write(_records(["AAPL", "MSFT"]), asof="2026-06-16", sig="abc")
    hits, misses = cache.split(["AAPL", "MSFT", "NVDA"], asof="2026-06-16", sig="abc")
    assert sorted(hits.index.tolist()) == ["AAPL", "MSFT"]
    assert misses == ["NVDA"]
    assert hits.loc["AAPL", "mom_6m"] == 1.0


def test_split_isolated_by_asof_and_sig(tmp_path):
    cache = EvalCache(root=tmp_path)
    cache.write(_records(["AAPL"]), asof="2026-06-16", sig="abc")
    _, misses_day = cache.split(["AAPL"], asof="2026-06-17", sig="abc")
    _, misses_sig = cache.split(["AAPL"], asof="2026-06-16", sig="zzz")
    assert misses_day == ["AAPL"]
    assert misses_sig == ["AAPL"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_eval_cache.py -q`
Expected: FAIL with `ImportError: cannot import name 'EvalCache'`.

- [ ] **Step 3: Write minimal implementation**

```python
# append to src/swing_screener/selection/eval_cache.py
import logging
import re
import uuid
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


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
            except Exception as exc:  # corrupted file -> treat as miss, drop it
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
        for ticker, row in records.iterrows():
            frame = row.to_frame().T
            frame.index.name = records.index.name or "ticker"
            path = self._path(str(ticker), asof, sig)
            tmp = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex}")
            try:
                frame.to_parquet(tmp)
                tmp.replace(path)
            except Exception as exc:
                logger.warning("Failed writing eval cache %s: %s", path, exc)
                tmp.unlink(missing_ok=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_eval_cache.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/selection/eval_cache.py tests/test_eval_cache.py
git commit -m "feat(eval-cache): per-symbol parquet split/write store"
```

---

## Task 3: EvalCache retention prune (24h)

**Files:**
- Modify: `src/swing_screener/selection/eval_cache.py`
- Test: `tests/test_eval_cache.py`

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_eval_cache.py
import os
import time


def test_prune_removes_old_files(tmp_path):
    cache = EvalCache(root=tmp_path)
    cache.write(_records(["AAPL"]), asof="2026-06-16", sig="abc")
    path = cache._path("AAPL", "2026-06-16", "abc")
    old = time.time() - 25 * 3600
    os.utime(path, (old, old))
    cache.write(_records(["MSFT"]), asof="2026-06-16", sig="abc")  # fresh
    cache.prune(max_age_sec=24 * 3600)
    assert not path.exists()
    assert cache._path("MSFT", "2026-06-16", "abc").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_eval_cache.py::test_prune_removes_old_files -q`
Expected: FAIL with `AttributeError: 'EvalCache' object has no attribute 'prune'`.

- [ ] **Step 3: Write minimal implementation**

```python
# append to EvalCache class in src/swing_screener/selection/eval_cache.py
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
```

Add `import time` and `import os` at the top of the module if not already present (the prune test imports `os`/`time` itself; the module needs `time`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_eval_cache.py -q`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/selection/eval_cache.py tests/test_eval_cache.py
git commit -m "feat(eval-cache): 24h retention prune"
```

---

## Task 4: Extract `compute_symbol_records` (pure refactor, no cache)

**Files:**
- Modify: `src/swing_screener/strategy/modules/momentum.py:71-161`
- Test: `tests/test_screener_service.py` (existing suite is the regression guard)

Pull the universe-independent per-symbol computation out of `build_momentum_report` into `compute_symbol_records(ohlcv, cfg, sector_benchmark_returns)`, returning a per-ticker DataFrame that joins feature table + signal board + setup quality for the **full eligible set** (not just post-ranking `top_n`). Then rewrite `build_momentum_report` to call it and do only the cross-sectional stage. Output of `build_momentum_report` must stay identical, so existing report/screener tests are the proof.

- [ ] **Step 1: Run the existing suite first to capture the green baseline**

Run: `pytest tests/test_screener_service.py tests/test_ranking.py tests/test_entries.py -q`
Expected: PASS. Record the count; it must not drop after the refactor.

- [ ] **Step 2: Add `compute_symbol_records` and restructure `build_momentum_report`**

```python
# src/swing_screener/strategy/modules/momentum.py
def compute_symbol_records(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig,
    sector_benchmark_returns: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Universe-independent per-symbol evaluation row for every ticker in ohlcv.

    Joins universe feature table (incl. ``is_eligible``) with the entry signal
    board and setup-quality features. Cross-sectional ranking is NOT applied here.
    """
    from swing_screener.selection.universe import build_universe

    feats = build_universe(ohlcv, cfg.universe, sector_benchmark_returns=sector_benchmark_returns)
    if feats is None or feats.empty:
        return pd.DataFrame()

    tickers = [str(t) for t in feats.index]
    board = build_signal_board(ohlcv, tickers, cfg.signals)
    setup = compute_setup_quality(ohlcv, tickers)

    records = feats.join(board, how="left", rsuffix="_sig")
    if setup is not None and not setup.empty:
        records = records.join(setup, how="left", rsuffix="_sq")
    return records


def build_momentum_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig,
    exclude_tickers: Iterable[str] | None = None,
    sector_benchmark_returns: dict[str, float] | None = None,
    records: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Cross-sectional assembly over per-symbol records.

    When ``records`` is provided (e.g. from the eval cache), the per-symbol stage
    is skipped; otherwise it is computed via ``compute_symbol_records``.
    """
    if records is None:
        records = compute_symbol_records(ohlcv, cfg, sector_benchmark_returns=sector_benchmark_returns)
    if records is None or records.empty:
        return pd.DataFrame()

    exclude = _normalize_ticker_set(exclude_tickers)
    if exclude:
        records = records.drop(index=list(exclude), errors="ignore")

    eligible = records[records["is_eligible"]] if "is_eligible" in records.columns else records
    if eligible.empty:
        return pd.DataFrame()
    eligible = eligible.sort_values(["mom_6m", "rs_6m"], ascending=False)

    ranked = top_candidates(eligible, cfg.ranking)
    if ranked.empty:
        return pd.DataFrame()

    tickers = ranked.index.tolist()
    board = records.loc[records.index.intersection(tickers)]
    atr_col = f"atr{cfg.universe.vol.atr_window}"

    plans = build_trade_plans(ranked, board, cfg.risk, atr_col=atr_col)

    report = ranked.join(board, how="left", rsuffix="_sig")
    if plans is not None and not plans.empty:
        plan_cols = ["entry", "stop", "shares", "position_value", "realized_risk", "risk_amount_target"]
        plan_cols = [c for c in plan_cols if c in plans.columns]
        report = report.join(plans[plan_cols + ["signal"]], how="left", rsuffix="_plan")
        if "signal_plan" in report.columns:
            report["signal"] = report["signal_plan"].fillna(report["signal"])
            report = report.drop(columns=["signal_plan"], errors="ignore")

    report["confidence"] = _compute_confidence(report, cfg.universe.filt.max_atr_pct)

    ma_col = f"ma{cfg.signals.pullback_ma}_level"
    keep = [
        "rank", "score", "confidence",
        "last", "currency", atr_col, "atr_pct",
        "mom_6m", "mom_12m", "rs_6m", "sector_rs_6m",
        "sma20_slope", "sma50_slope",
        "trend_ok", "dist_sma50_pct", "dist_sma200_pct",
        "weekly_trend",
        "signal",
        "breakout_level", ma_col,
        "consolidation_tightness", "close_location_in_range",
        "above_breakout_extension", "breakout_volume_confirmation",
        "dist_52w_high_pct", "near_52w_high",
        "volume_ratio", "avg_daily_volume_eur",
        "entry", "stop", "shares", "position_value", "realized_risk",
    ]
    keep = [c for c in keep if c in report.columns]
    report = report[keep]

    if cfg.only_active_signals and "signal" in report.columns:
        report = report[report["signal"].isin(["both", "breakout", "pullback"])]

    if "signal" in report.columns and "score" in report.columns:
        order = {"both": 0, "breakout": 1, "pullback": 2, "none": 3}
        report["signal_order"] = report["signal"].map(order).fillna(99).astype(int)
        report = report.sort_values(["signal_order", "score"], ascending=[True, False]).drop(columns=["signal_order"])

    report = add_execution_guidance(report)
    return report
```

Note: `top_candidates(eligible, …)` re-ranks `score` over the eligible set exactly as before (`eligible_universe` previously fed the same set). `board` is now sliced from `records` instead of recomputed, which is equivalent because `records` already holds every eligible ticker's signal columns.

- [ ] **Step 3: Run the regression suite**

Run: `pytest tests/test_screener_service.py tests/test_ranking.py tests/test_entries.py -q`
Expected: PASS with the same count as Step 1. If a column-name mismatch appears (e.g. a `_sig`/`_sq` suffix changed), reconcile the `keep`/join suffixes until green.

- [ ] **Step 4: Run the full backend suite**

Run: `pytest -m "not integration" -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/strategy/modules/momentum.py
git commit -m "refactor(momentum): split per-symbol records from cross-sectional ranking"
```

---

## Task 5: Thread cache params through the report orchestrators

**Files:**
- Modify: `src/swing_screener/strategy/modules/momentum.py` (the `MomentumStrategyModule.build_report` wrapper)
- Modify: `src/swing_screener/strategy/orchestrator.py:11-23`
- Modify: `src/swing_screener/reporting/report.py:11-24`
- Test: `tests/test_eval_cache.py`

Add optional `eval_cache` + `asof_date` to the orchestration chain so `build_daily_report` can route the per-symbol stage through the cache. When both are present: compute the signature, `split`, compute records for misses only, `write` them, then call `build_momentum_report(records=combined)`.

- [ ] **Step 1: Write the failing test**

```python
# add to tests/test_eval_cache.py
from unittest.mock import patch
import swing_screener.reporting.report as report_mod


def test_build_daily_report_computes_only_misses(tmp_path, monkeypatch):
    cache = EvalCache(root=tmp_path)
    calls = []

    def fake_compute(ohlcv, cfg, sector_benchmark_returns=None):
        tks = [str(c) for c in ohlcv["Close"].columns]
        calls.append(tuple(sorted(tks)))
        return _records(tks)

    monkeypatch.setattr(
        "swing_screener.strategy.modules.momentum.compute_symbol_records", fake_compute
    )

    ohlcv = pd.DataFrame(
        {("Close", "AAPL"): [1.0], ("Close", "MSFT"): [1.0]},
    )
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    report_mod.build_daily_report(ohlcv, eval_cache=cache, asof_date="2026-06-16")
    report_mod.build_daily_report(ohlcv, eval_cache=cache, asof_date="2026-06-16")

    assert calls[0] == ("AAPL", "MSFT")   # cold run computes both
    assert len(calls) == 1                  # warm run computes nothing
```

(The assembly result is irrelevant here; the test asserts the cache short-circuits the per-symbol compute on the second call. `_records` returning a minimal frame is enough — `build_momentum_report` may return empty, which is fine.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_eval_cache.py::test_build_daily_report_computes_only_misses -q`
Expected: FAIL — `build_daily_report` does not accept `eval_cache` / `asof_date`.

- [ ] **Step 3: Implement threading + cache routing**

```python
# src/swing_screener/reporting/report.py — update build_daily_report signature/body
def build_daily_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig = ReportConfig(),
    exclude_tickers: Iterable[str] | None = None,
    sector_benchmark_returns: dict[str, float] | None = None,
    eval_cache=None,
    asof_date: str | None = None,
) -> pd.DataFrame:
    from swing_screener.strategy.orchestrator import build_strategy_report

    return build_strategy_report(
        ohlcv=ohlcv,
        cfg=cfg,
        exclude_tickers=exclude_tickers,
        sector_benchmark_returns=sector_benchmark_returns,
        eval_cache=eval_cache,
        asof_date=asof_date,
    )
```

```python
# src/swing_screener/strategy/orchestrator.py — pass through to the module
def build_strategy_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig = ReportConfig(),
    exclude_tickers: Iterable[str] | None = None,
    sector_benchmark_returns: dict[str, float] | None = None,
    eval_cache=None,
    asof_date: str | None = None,
) -> pd.DataFrame:
    module = get_strategy_module(cfg.strategy_module)
    return module.build_report(
        ohlcv,
        cfg=cfg,
        exclude_tickers=exclude_tickers,
        sector_benchmark_returns=sector_benchmark_returns,
        eval_cache=eval_cache,
        asof_date=asof_date,
    )
```

```python
# src/swing_screener/strategy/modules/momentum.py — MomentumStrategyModule.build_report
import pandas as pd
from swing_screener.selection.eval_cache import strategy_signature

@dataclass(frozen=True)
class MomentumStrategyModule:
    name: str = "momentum"

    def build_report(
        self,
        ohlcv,
        cfg=ReportConfig(),
        exclude_tickers=None,
        sector_benchmark_returns=None,
        eval_cache=None,
        asof_date=None,
    ):
        if eval_cache is None or asof_date is None:
            return build_momentum_report(
                ohlcv, cfg=cfg, exclude_tickers=exclude_tickers,
                sector_benchmark_returns=sector_benchmark_returns,
            )

        sig = strategy_signature(cfg)
        all_tickers = [str(t) for t in ohlcv["Close"].columns] if "Close" in ohlcv.columns.get_level_values(0) else []
        hits, misses = eval_cache.split(all_tickers, asof=asof_date, sig=sig)

        miss_records = pd.DataFrame()
        if misses:
            miss_ohlcv = ohlcv.loc[:, ohlcv.columns.get_level_values(1).isin(misses)]
            miss_records = compute_symbol_records(
                miss_ohlcv, cfg, sector_benchmark_returns=sector_benchmark_returns
            )
            eval_cache.write(miss_records, asof=asof_date, sig=sig)

        frames = [f for f in (hits, miss_records) if f is not None and not f.empty]
        records = pd.concat(frames) if frames else pd.DataFrame()
        records = records[~records.index.duplicated(keep="last")]
        return build_momentum_report(
            ohlcv, cfg=cfg, exclude_tickers=exclude_tickers,
            sector_benchmark_returns=sector_benchmark_returns, records=records,
        )
```

Add a `force_refresh: bool = False` param to the same chain (`build_daily_report` → `build_strategy_report` → `build_report`); when true, skip the `split` read (treat all as misses) but still `write`. Default `False` keeps every existing caller unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_eval_cache.py -q`
Expected: PASS (all eval-cache tests).

- [ ] **Step 5: Run the backend suite**

Run: `pytest -m "not integration" -q`
Expected: PASS (orchestrator/report callers unaffected because new params default to `None`/`False`).

- [ ] **Step 6: Commit**

```bash
git add src/swing_screener/reporting/report.py src/swing_screener/strategy/orchestrator.py src/swing_screener/strategy/modules/momentum.py tests/test_eval_cache.py
git commit -m "feat(eval-cache): route per-symbol stage through cache in daily report"
```

---

## Task 6: Wire EvalCache into ScreenerService (A + C)

**Files:**
- Modify: `api/services/screener_service.py:443-565` (`_run_daily_report` call site) and `__init__`
- Modify: `api/models/screener.py` (add `force_refresh`)
- Test: `tests/test_screener_service.py`

The service already resolves `ctx.asof_str` and `ctx.report_cfg`. Construct one `EvalCache` (path from settings) in `__init__`, and pass it + `ctx.asof_str` into `build_daily_report` inside `_run_daily_report`. Because both the manual screen and `daily_review_service` route through `run_screener`, C is delivered automatically: overlapping symbols hit the same on-disk cache. Call `prune()` once per run.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_screener_service.py — new test using the suite's existing fixtures
def test_mixed_universe_reuses_cached_symbols(screener_service_with_fake_provider, monkeypatch):
    """Second screen over an overlapping universe recomputes only the new symbols."""
    import swing_screener.strategy.modules.momentum as mm
    svc, fake = screener_service_with_fake_provider  # adapt to the file's actual fixture
    seen = []
    real = mm.compute_symbol_records
    def spy(ohlcv, cfg, sector_benchmark_returns=None):
        seen.append({str(c) for c in ohlcv["Close"].columns})
        return real(ohlcv, cfg, sector_benchmark_returns=sector_benchmark_returns)
    monkeypatch.setattr(mm, "compute_symbol_records", spy)

    svc.run_screener(make_request(universe="set_a"))   # symbols {A,B,C}
    seen.clear()
    svc.run_screener(make_request(universe="set_b"))   # symbols {B,C,D}
    computed = set().union(*seen) if seen else set()
    assert "D" in computed
    assert {"A", "B", "C"} & computed == set()  # already cached -> not recomputed
```

Adapt `screener_service_with_fake_provider` / `make_request` to the helpers already present in `tests/test_screener_service.py`. If the file builds the service inline, mirror that and point the `EvalCache` root at a `tmp_path`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_screener_service.py::test_mixed_universe_reuses_cached_symbols -q`
Expected: FAIL — the service does not yet pass an `eval_cache`, so both runs recompute every symbol.

- [ ] **Step 3: Implement the wiring**

```python
# api/services/screener_service.py — __init__
from swing_screener.selection.eval_cache import EvalCache
from swing_screener.settings import get_settings_manager
...
        self._eval_cache = EvalCache(
            root=get_settings_manager().resolve_runtime_path("eval_cache_dir", ".cache/eval")
        )
```

```python
# api/services/screener_service.py — inside _run_daily_report, replace the build_daily_report call
        results = build_daily_report(
            ctx.ohlcv,
            cfg=ctx.report_cfg,
            exclude_tickers=sector_rotation.SECTOR_ETFS.keys(),
            sector_benchmark_returns=sector_benchmark_returns,
            eval_cache=self._eval_cache,
            asof_date=ctx.asof_str,
            force_refresh=bool(getattr(ctx.request, "force_refresh", False)),
        )
        try:
            self._eval_cache.prune()
        except Exception as exc:  # pragma: no cover - cache hygiene must never break a run
            logger.debug("Eval cache prune failed: %s", exc)
```

```python
# api/models/screener.py — add to ScreenerRequest
    force_refresh: bool = False
```

For tests that construct the service directly, allow overriding the cache root (e.g. accept an optional `eval_cache` in `__init__`, defaulting to the settings-derived one) so the test can inject a `tmp_path`-backed instance.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_screener_service.py -q`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `pytest -m "not integration" -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/services/screener_service.py api/models/screener.py tests/test_screener_service.py
git commit -m "feat(screener): per-symbol eval cache + force_refresh; daily-review reuse"
```

---

## Task 7: Force-refresh end-to-end + daily-review-reuse assertions

**Files:**
- Test: `tests/test_screener_service.py`

Lock in the two behaviours the spec calls out: force-refresh bypasses reads (whole-run) and a daily-review after a manual screen recomputes nothing for overlapping symbols.

- [ ] **Step 1: Write the tests**

```python
# tests/test_screener_service.py
def test_force_refresh_recomputes_all(screener_service_with_fake_provider, monkeypatch):
    import swing_screener.strategy.modules.momentum as mm
    svc, _ = screener_service_with_fake_provider
    seen = []
    real = mm.compute_symbol_records
    monkeypatch.setattr(mm, "compute_symbol_records",
                        lambda o, c, sector_benchmark_returns=None: (seen.append(1) or real(o, c, sector_benchmark_returns=sector_benchmark_returns)))
    svc.run_screener(make_request(universe="set_a"))
    seen.clear()
    svc.run_screener(make_request(universe="set_a", force_refresh=True))
    assert seen, "force_refresh must recompute despite warm cache"


def test_daily_review_reuses_manual_screen(daily_review_service_with_shared_cache, monkeypatch):
    import swing_screener.strategy.modules.momentum as mm
    svc_screen, svc_review = daily_review_service_with_shared_cache  # share one EvalCache root
    svc_screen.run_screener(make_request(universe="set_a"))
    seen = []
    real = mm.compute_symbol_records
    monkeypatch.setattr(mm, "compute_symbol_records",
                        lambda o, c, sector_benchmark_returns=None: (seen.append({str(x) for x in o["Close"].columns}) or real(o, c, sector_benchmark_returns=sector_benchmark_returns)))
    svc_review.generate_daily_review(top_n=10, universe="set_a")
    computed = set().union(*seen) if seen else set()
    assert computed == set(), "daily-review must reuse cached per-symbol records"
```

Wire `daily_review_service_with_shared_cache` so the `DailyReviewService`'s `ScreenerService` uses the **same** `EvalCache` root as the manual `ScreenerService`, and both resolve the same `asof` + strategy signature.

- [ ] **Step 2: Run the tests**

Run: `pytest tests/test_screener_service.py -k "force_refresh or daily_review_reuses" -q`
Expected: PASS. If `daily_review_reuses` fails because the asof or signature differ between entry points, fix the alignment (both must resolve identical `asof_str` and `strategy_signature`) until green.

- [ ] **Step 3: Run the full backend suite**

Run: `pytest -m "not integration" -q`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/test_screener_service.py
git commit -m "test(eval-cache): force-refresh bypass + daily-review reuse"
```

---

## Task 8: Documentation

**Files:**
- Modify: `src/swing_screener/data/README.md`
- Modify: `src/swing_screener/data/OPTIMIZATION_GUIDE.md`
- Modify: `config/README.md`

- [ ] **Step 1: Document the eval cache**

Add to `src/swing_screener/data/README.md` a section describing `.cache/eval/{strategy_sig}/{asof_date}/{SYMBOL}.parquet`: what is cached (deterministic per-symbol features only), what is NOT (cross-sectional `score`/`rank`/`confidence`, position sizing, catalyst/intelligence), the key, mixed-universe sharing, 24h retention, and the `force_refresh` bypass.

Add to `src/swing_screener/data/OPTIMIZATION_GUIDE.md` a note that per-symbol evaluation is cached on top of the existing per-symbol OHLCV cache, so a re-run over an overlapping universe recomputes only new symbols.

Add to `config/README.md` the `eval_cache_dir` runtime path key (default `.cache/eval`) and the 24h retention behaviour.

- [ ] **Step 2: Verify no doc references stale paths**

Run: `grep -rn "eval_cache\|\.cache/eval" src/swing_screener/data/README.md config/README.md`
Expected: matches present and accurate.

- [ ] **Step 3: Commit**

```bash
git add src/swing_screener/data/README.md src/swing_screener/data/OPTIMIZATION_GUIDE.md config/README.md
git commit -m "docs(eval-cache): document per-symbol evaluation cache"
```

---

## Self-Review

**Spec coverage**

- Cache boundary (per-symbol features cached; cross-sectional recomputed) → Task 4 (`compute_symbol_records` vs `build_momentum_report`), proven by Task 7 mixed-universe test.
- Pipeline restructure (full eligible set before ranking) → Task 4.
- Parquet-per-symbol store, hit/miss split, compute-only-misses → Tasks 2, 5.
- Strategy signature from per-symbol config only → Task 1.
- Mixed-universe sharing → Task 6 test.
- C (daily-review reuse) → Task 6 wiring + Task 7 assertion.
- New-day / strategy-edit invalidation → key layout (Task 2, `test_split_isolated_by_asof_and_sig`).
- 24h retention → Task 3.
- Whole-run force-refresh → Tasks 5–7.
- Non-goal: intelligence/LLM not cached → only deterministic features are written (Task 4); not contradicted anywhere.

**Placeholder scan:** Tests reference fixtures (`screener_service_with_fake_provider`, `make_request`, `daily_review_service_with_shared_cache`) that must be adapted to the existing `tests/test_screener_service.py` helpers — flagged inline in each task. These are the only adaptation points; all production code is complete.

**Type consistency:** `compute_symbol_records(ohlcv, cfg, sector_benchmark_returns=None)`, `build_momentum_report(..., records=None)`, `EvalCache.split(tickers, asof, sig) -> (DataFrame, list)`, `EvalCache.write(records, asof, sig)`, `EvalCache.prune(max_age_sec)`, `strategy_signature(cfg) -> str` are used identically across Tasks 1–7.

**Known follow-ups (out of scope, do not block):** frontend React Query persistence; caching catalyst/intelligence.
