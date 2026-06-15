# Candlestick Chart + Pattern Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic candlestick-pattern engine, a candle chart in the full symbol views, and use the patterns to enrich the LLM narrative and refine entry/stop — without touching ranking/setup score.

**Architecture:** A single pure engine (`indicators/candles.py`) detects a curated 6-pattern set with contextual labels. Three consumers reuse it: the screener/watchlist price-history payload (extended with OHLCV + patterns → new SVG `CandleChart`), `execution/guidance.py` (structural stop), and `intelligence/symbol_analyzer.py` (prompt block). Backward-compatible optional fields throughout.

**Tech Stack:** Python (pandas, pydantic, FastAPI), React 18 + TypeScript (Vite, Vitest, hand-rolled SVG), pytest.

**Spec:** `docs/superpowers/specs/2026-06-14-candlestick-chart-pattern-reader-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/swing_screener/indicators/candles.py` (create) | `CandleConfig`, `CandlePattern`, single/two-bar detectors, `detect_patterns`, context labelling |
| `config/defaults.yaml` (modify) | `low_level.candles` thresholds + `low_level.execution.pattern_stop_*` |
| `src/swing_screener/execution/guidance.py` (modify) | `pattern_stop` / `pattern_stop_reason` columns |
| `api/models/screener.py` (modify) | `PriceHistoryPoint` OHLCV, `CandlePatternOut`, candidate `patterns` + `pattern_stop*` |
| `api/models/watchlist.py` (modify) | watchlist item `patterns` + OHLCV history |
| `api/services/screener_service.py` (modify) | `_price_history_map` emits OHLCV; compute + attach patterns / pattern_stop |
| `api/services/watchlist_service.py` (modify) | same plumbing for watchlist |
| `src/swing_screener/intelligence/models.py` (modify) | `recent_patterns` request field |
| `src/swing_screener/intelligence/symbol_analyzer.py` (modify) | render patterns in prompt |
| `web-ui/src/features/screener/types.ts` (modify) | `PriceHistoryPoint` OHLCV, `CandlePattern`, candidate fields |
| `web-ui/src/features/screener/api.ts` (modify) | transform OHLCV + patterns at boundary |
| `web-ui/src/features/watchlist/types.ts` + `api.ts` (modify) | same for watchlist |
| `web-ui/src/components/domain/market/CandleChart.tsx` (create) | SVG candles + volume + pattern markers |
| `web-ui/src/i18n/messages.en.ts` (modify) | pattern / context labels |
| `web-ui/src/components/domain/workspace/WorkspaceSymbolModal.tsx` + `SymbolAnalysisContent.tsx` (modify) | swap line chart → `CandleChart` |
| docs (modify) | `config/README.md`, `api/README.md`, `web-ui/docs/WEB_UI_GUIDE.md`, `intelligence/README.md`, `data/README.md`, `docs/overview/INDEX.md` |

---

## Phase 1 — Core pattern engine

### Task 1: CandleConfig + dataclasses + single-bar detectors

**Files:**
- Create: `src/swing_screener/indicators/candles.py`
- Test: `tests/test_candles.py`

- [ ] **Step 1: Write failing tests for single-bar detectors**

```python
# tests/test_candles.py
import pandas as pd
from swing_screener.indicators.candles import (
    CandleConfig, _bar_metrics, _is_doji, _is_hammer, _is_shooting_star,
)


def _bar(o, h, l, c):
    return _bar_metrics(o, h, l, c)


def test_hammer_true():
    # small body at top, long lower wick, tiny upper wick
    m = _bar(o=10.0, h=10.2, l=8.0, c=10.1)
    assert _is_hammer(m, CandleConfig()) is True


def test_hammer_false_when_lower_wick_too_short():
    m = _bar(o=10.0, h=10.2, l=9.8, c=10.1)
    assert _is_hammer(m, CandleConfig()) is False


def test_shooting_star_true():
    m = _bar(o=10.0, h=12.0, l=9.9, c=10.05)
    assert _is_shooting_star(m, CandleConfig()) is True


def test_doji_true():
    m = _bar(o=10.0, h=10.5, l=9.5, c=10.01)
    assert _is_doji(m, CandleConfig()) is True


def test_doji_false_when_body_large():
    m = _bar(o=10.0, h=10.6, l=9.9, c=10.5)
    assert _is_doji(m, CandleConfig()) is False
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pytest tests/test_candles.py -q`
Expected: FAIL — `ModuleNotFoundError: swing_screener.indicators.candles`

- [ ] **Step 3: Implement config, metrics, single-bar detectors**

```python
# src/swing_screener/indicators/candles.py
"""Deterministic candlestick pattern detection.

Pure functions: OHLCV in, patterns out. No state, no I/O. Thresholds come from
config (low_level.candles). Patterns are advisory and contextual — they never
feed the ranking/setup score.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

import pandas as pd

from swing_screener.settings.manager import get_settings_manager


def _candle_defaults() -> dict:
    d = get_settings_manager().get_low_level_defaults_payload("candles")
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class CandleConfig:
    lookback: int = field(default_factory=lambda: int(_candle_defaults().get("lookback", 10)))
    doji_body_ratio: float = field(default_factory=lambda: float(_candle_defaults().get("doji_body_ratio", 0.1)))
    hammer_lower_wick_mult: float = field(default_factory=lambda: float(_candle_defaults().get("hammer_lower_wick_mult", 2.0)))
    hammer_max_opposite_wick_ratio: float = field(default_factory=lambda: float(_candle_defaults().get("hammer_max_opposite_wick_ratio", 0.25)))
    extension_threshold_pct: float = field(default_factory=lambda: float(_candle_defaults().get("extension_threshold_pct", 0.10)))
    breakout_lookback: int = field(default_factory=lambda: int(_candle_defaults().get("breakout_lookback", 50)))
    pullback_ma: int = field(default_factory=lambda: int(_candle_defaults().get("pullback_ma", 20)))


@dataclass(frozen=True)
class _Metrics:
    o: float
    h: float
    l: float
    c: float
    body: float
    rng: float
    upper_wick: float
    lower_wick: float


def _bar_metrics(o: float, h: float, l: float, c: float) -> _Metrics:
    body = abs(c - o)
    rng = h - l
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    return _Metrics(o=o, h=h, l=l, c=c, body=body, rng=rng, upper_wick=upper_wick, lower_wick=lower_wick)


def _is_doji(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0:
        return False
    return m.body <= cfg.doji_body_ratio * m.rng


def _is_hammer(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0 or m.body <= 0:
        return False
    if _is_doji(m, cfg):
        return False
    return (
        m.lower_wick >= cfg.hammer_lower_wick_mult * m.body
        and m.upper_wick <= cfg.hammer_max_opposite_wick_ratio * m.rng
    )


def _is_shooting_star(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0 or m.body <= 0:
        return False
    if _is_doji(m, cfg):
        return False
    return (
        m.upper_wick >= cfg.hammer_lower_wick_mult * m.body
        and m.lower_wick <= cfg.hammer_max_opposite_wick_ratio * m.rng
    )
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pytest tests/test_candles.py -q`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/indicators/candles.py tests/test_candles.py
git commit -m "feat(candles): config + single-bar pattern detectors"
```

---

### Task 2: Two-bar detectors (engulfing, inside/outside bar)

**Files:**
- Modify: `src/swing_screener/indicators/candles.py`
- Test: `tests/test_candles.py`

- [ ] **Step 1: Write failing tests**

```python
# append to tests/test_candles.py
from swing_screener.indicators.candles import (
    _is_bullish_engulfing, _is_bearish_engulfing, _is_inside_bar, _is_outside_bar,
)


def test_bullish_engulfing():
    prev = _bar(o=10.0, h=10.1, l=9.4, c=9.5)   # bearish
    cur = _bar(o=9.4, h=10.3, l=9.3, c=10.2)    # bullish, body engulfs prev body
    assert _is_bullish_engulfing(prev, cur) is True


def test_bearish_engulfing():
    prev = _bar(o=9.5, h=10.1, l=9.4, c=10.0)   # bullish
    cur = _bar(o=10.1, h=10.2, l=9.3, c=9.4)    # bearish, engulfs
    assert _is_bearish_engulfing(prev, cur) is True


def test_inside_bar():
    prev = _bar(o=9.5, h=10.5, l=9.0, c=10.0)
    cur = _bar(o=9.8, h=10.2, l=9.4, c=10.0)    # H/L inside prev
    assert _is_inside_bar(prev, cur) is True


def test_outside_bar():
    prev = _bar(o=9.8, h=10.2, l=9.4, c=10.0)
    cur = _bar(o=9.5, h=10.5, l=9.0, c=10.1)    # H/L contains prev
    assert _is_outside_bar(prev, cur) is True
```

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_candles.py -q`
Expected: FAIL — `ImportError: cannot import name '_is_bullish_engulfing'`

- [ ] **Step 3: Implement two-bar detectors**

```python
# append to src/swing_screener/indicators/candles.py
def _is_bullish_engulfing(prev: _Metrics, cur: _Metrics) -> bool:
    prev_bearish = prev.c < prev.o
    cur_bullish = cur.c > cur.o
    return prev_bearish and cur_bullish and cur.c >= prev.o and cur.o <= prev.c


def _is_bearish_engulfing(prev: _Metrics, cur: _Metrics) -> bool:
    prev_bullish = prev.c > prev.o
    cur_bearish = cur.c < cur.o
    return prev_bullish and cur_bearish and cur.o >= prev.c and cur.c <= prev.o


def _is_inside_bar(prev: _Metrics, cur: _Metrics) -> bool:
    return cur.h < prev.h and cur.low > prev.low


def _is_outside_bar(prev: _Metrics, cur: _Metrics) -> bool:
    return cur.h > prev.h and cur.low < prev.low
```

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_candles.py -q`
Expected: PASS (9 passed)

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/indicators/candles.py tests/test_candles.py
git commit -m "feat(candles): two-bar pattern detectors"
```

---

### Task 3: Context labelling

**Files:**
- Modify: `src/swing_screener/indicators/candles.py`
- Test: `tests/test_candles.py`

- [ ] **Step 1: Write failing tests**

```python
# append to tests/test_candles.py
import numpy as np
from swing_screener.indicators.candles import _context_for_latest, CandleConfig


def _close_series(values):
    idx = pd.date_range("2024-01-01", periods=len(values), freq="B")
    return pd.Series(values, index=idx)


def test_context_extended_when_far_above_prior_high():
    base = list(np.linspace(10, 20, 60))
    base[-1] = 30.0  # spike far above prior 50-bar high
    ctx = _context_for_latest(_close_series(base), CandleConfig())
    assert ctx == "extended"


def test_context_at_breakout():
    base = [10.0] * 60
    base[-1] = 11.0  # close above prior flat high, modest extension
    ctx = _context_for_latest(_close_series(base), CandleConfig())
    assert ctx == "at_breakout"


def test_context_none_for_flat_series():
    ctx = _context_for_latest(_close_series([10.0] * 60), CandleConfig())
    assert ctx == "none"
```

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_candles.py -k context -q`
Expected: FAIL — `ImportError: cannot import name '_context_for_latest'`

- [ ] **Step 3: Implement context labelling (reuse entries signals)**

```python
# append to src/swing_screener/indicators/candles.py
from swing_screener.selection.entries import breakout_signal, pullback_reclaim_signal


def _context_for_latest(close_s: pd.Series, cfg: CandleConfig) -> str:
    """Label the latest bar's setup context. Precedence: extended > at_breakout
    > at_pullback > none. 'extended' suppresses pattern-based stops downstream."""
    close_s = close_s.dropna()
    if len(close_s) < cfg.breakout_lookback + 2:
        return "none"

    last = float(close_s.iloc[-1])
    prior_high = float(close_s.iloc[-(cfg.breakout_lookback + 1):-1].max())
    if prior_high > 0 and (last / prior_high) - 1.0 >= cfg.extension_threshold_pct:
        return "extended"

    is_breakout, _ = breakout_signal(close_s, cfg.breakout_lookback)
    if is_breakout:
        return "at_breakout"

    is_pullback, _ = pullback_reclaim_signal(close_s, cfg.pullback_ma)
    if is_pullback:
        return "at_pullback"

    return "none"
```

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_candles.py -k context -q`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/indicators/candles.py tests/test_candles.py
git commit -m "feat(candles): latest-bar context labelling"
```

---

### Task 4: CandlePattern + detect_patterns orchestrator

**Files:**
- Modify: `src/swing_screener/indicators/candles.py`
- Test: `tests/test_candles.py`

- [ ] **Step 1: Write failing tests**

```python
# append to tests/test_candles.py
from swing_screener.indicators.candles import detect_patterns, CandlePattern


def _ohlcv(rows, ticker="AAA"):
    # rows: list of (o,h,l,c,v); build (field,ticker) MultiIndex frame
    idx = pd.date_range("2024-01-01", periods=len(rows), freq="B")
    data = {}
    for fi, fname in enumerate(["Open", "High", "Low", "Close", "Volume"]):
        data[(fname, ticker)] = [r[fi] for r in rows]
    cols = pd.MultiIndex.from_tuples(list(data.keys()), names=["field", "ticker"])
    return pd.DataFrame({k: v for k, v in data.items()}, index=idx).reindex(columns=cols)


def test_detect_patterns_finds_latest_hammer_with_context():
    rows = [(10, 10.1, 9.9, 10.0, 1000)] * 59
    rows.append((10.0, 10.2, 8.0, 10.1, 1500))  # hammer on last bar
    out = detect_patterns(_ohlcv(rows), lookback=5)
    assert "AAA" in out
    names = {p.name for p in out["AAA"]}
    assert "hammer" in names
    hammer = next(p for p in out["AAA"] if p.name == "hammer")
    assert hammer.direction == "bullish"
    assert hammer.key_level == 8.0
    assert hammer.context in {"at_breakout", "at_pullback", "extended", "none"}


def test_detect_patterns_empty_for_short_series():
    rows = [(10, 10.1, 9.9, 10.0, 1000)] * 3
    assert detect_patterns(_ohlcv(rows)) == {"AAA": []} or detect_patterns(_ohlcv(rows)) == {}


def test_detect_patterns_handles_missing_ohlc():
    idx = pd.date_range("2024-01-01", periods=5, freq="B")
    df = pd.DataFrame({("Close", "AAA"): [1, 2, 3, 4, 5]}, index=idx)
    df.columns = pd.MultiIndex.from_tuples([("Close", "AAA")], names=["field", "ticker"])
    assert detect_patterns(df) == {} or detect_patterns(df) == {"AAA": []}
```

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_candles.py -k detect -q`
Expected: FAIL — `ImportError: cannot import name 'detect_patterns'`

- [ ] **Step 3: Implement CandlePattern + detect_patterns**

```python
# append to src/swing_screener/indicators/candles.py


@dataclass(frozen=True)
class CandlePattern:
    ticker: str
    bar_index: int
    date: str
    name: str
    direction: str  # bullish | bearish | neutral
    key_level: float
    context: str    # at_breakout | at_pullback | extended | none


def _field(ohlcv: pd.DataFrame, name: str) -> pd.DataFrame | None:
    if name not in ohlcv.columns.get_level_values(0):
        return None
    sub = ohlcv[name]
    return sub if isinstance(sub, pd.DataFrame) else sub.to_frame()


def detect_patterns(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str] | None = None,
    *,
    lookback: int | None = None,
    cfg: CandleConfig = CandleConfig(),
) -> dict[str, list[CandlePattern]]:
    """Detect curated candlestick patterns over the last `lookback` bars per
    ticker. Context is computed for the latest bar and attached to patterns on
    that bar; older patterns get context 'none'. Returns {} when OHLC absent."""
    o_m, h_m, l_m, c_m = (_field(ohlcv, f) for f in ("Open", "High", "Low", "Close"))
    if any(x is None for x in (o_m, h_m, l_m, c_m)) or c_m.empty:
        return {}

    lb = lookback if lookback is not None else cfg.lookback
    all_tickers = list(c_m.columns)
    if tickers is not None:
        wanted = {str(t).strip().upper() for t in tickers if t and str(t).strip()}
        all_tickers = [t for t in all_tickers if str(t).strip().upper() in wanted]

    out: dict[str, list[CandlePattern]] = {}
    for tk in all_tickers:
        o = o_m[tk]; h = h_m[tk]; l = l_m[tk]; c = c_m[tk]
        frame = pd.concat([o, h, l, c], axis=1, keys=["o", "h", "l", "c"]).dropna()
        if len(frame) < 2:
            out[tk] = []
            continue

        latest_ctx = _context_for_latest(c, cfg)
        n = len(frame)
        start = max(1, n - lb)
        patterns: list[CandlePattern] = []
        for i in range(start, n):
            row = frame.iloc[i]
            prev = frame.iloc[i - 1]
            m = _bar_metrics(row.o, row.h, row.l, row.c)
            pm = _bar_metrics(prev.o, prev.h, prev.l, prev.c)
            date = str(frame.index[i].date())
            ctx = latest_ctx if i == n - 1 else "none"

            found: list[tuple[str, str, float]] = []  # (name, direction, key_level)
            if _is_hammer(m, cfg):
                found.append(("hammer", "bullish", m.low))
            if _is_shooting_star(m, cfg):
                found.append(("shooting_star", "bearish", m.h))
            if _is_doji(m, cfg):
                found.append(("doji", "neutral", m.c))
            if _is_bullish_engulfing(pm, m):
                found.append(("bullish_engulfing", "bullish", m.low))
            if _is_bearish_engulfing(pm, m):
                found.append(("bearish_engulfing", "bearish", m.h))
            if _is_inside_bar(pm, m):
                found.append(("inside_bar", "bullish", m.low))
            if _is_outside_bar(pm, m):
                direction = "bullish" if m.c >= m.o else "bearish"
                found.append(("outside_bar", direction, m.low if direction == "bullish" else m.h))

            for name, direction, key_level in found:
                patterns.append(CandlePattern(
                    ticker=str(tk), bar_index=i, date=date, name=name,
                    direction=direction, key_level=float(key_level), context=ctx,
                ))
        out[tk] = patterns
    return out
```

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_candles.py -q`
Expected: PASS (all)

- [ ] **Step 5: Add config block + commit**

Add under `low_level:` in `config/defaults.yaml` (after the `execution:` block):

```yaml
  candles:
    lookback: 10
    doji_body_ratio: 0.1
    hammer_lower_wick_mult: 2.0
    hammer_max_opposite_wick_ratio: 0.25
    extension_threshold_pct: 0.10
    breakout_lookback: 50
    pullback_ma: 20
```

```bash
git add src/swing_screener/indicators/candles.py tests/test_candles.py config/defaults.yaml
git commit -m "feat(candles): detect_patterns orchestrator + config defaults"
```

---

## Phase 2 — Execution stop refinement

### Task 5: pattern_stop in execution guidance

**Files:**
- Modify: `src/swing_screener/execution/guidance.py`
- Modify: `config/defaults.yaml` (`low_level.execution`)
- Test: `tests/test_execution_guidance.py`

- [ ] **Step 1: Write failing test**

Read `tests/test_execution_guidance.py` first to reuse its fixture style for `add_execution_guidance` (board DataFrame indexed by ticker with `last`, `atr14`, breakout/pullback columns). Add:

```python
# tests/test_execution_guidance.py
from swing_screener.indicators.candles import CandlePattern
from swing_screener.execution.guidance import apply_pattern_stop


def test_apply_pattern_stop_tightens_below_hammer_low():
    patterns = {"AAA": [CandlePattern(
        ticker="AAA", bar_index=59, date="2024-03-01", name="hammer",
        direction="bullish", key_level=9.0, context="at_pullback",
    )]}
    stop, reason = apply_pattern_stop(
        ticker="AAA", entry=10.0, current_stop=8.0, atr=0.5,
        patterns=patterns, buffer_atr=0.25, min_rr_stop=None,
    )
    assert stop == 9.0 - 0.25 * 0.5
    assert "hammer" in reason.lower()


def test_apply_pattern_stop_skips_when_extended():
    patterns = {"AAA": [CandlePattern(
        ticker="AAA", bar_index=59, date="2024-03-01", name="hammer",
        direction="bullish", key_level=9.0, context="extended",
    )]}
    stop, reason = apply_pattern_stop(
        ticker="AAA", entry=10.0, current_stop=8.0, atr=0.5,
        patterns=patterns, buffer_atr=0.25, min_rr_stop=None,
    )
    assert stop is None and reason is None


def test_apply_pattern_stop_keeps_atr_when_pattern_stop_wider():
    patterns = {"AAA": [CandlePattern(
        ticker="AAA", bar_index=59, date="2024-03-01", name="hammer",
        direction="bullish", key_level=7.0, context="at_pullback",
    )]}
    stop, reason = apply_pattern_stop(
        ticker="AAA", entry=10.0, current_stop=8.0, atr=0.5,
        patterns=patterns, buffer_atr=0.25, min_rr_stop=None,
    )
    # pattern stop 6.875 is wider than ATR stop 8.0 -> keep ATR, no override
    assert stop is None and reason is None
```

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_execution_guidance.py -k pattern_stop -q`
Expected: FAIL — `ImportError: cannot import name 'apply_pattern_stop'`

- [ ] **Step 3: Implement `apply_pattern_stop`**

```python
# add to src/swing_screener/execution/guidance.py (module-level)
from swing_screener.indicators.candles import CandlePattern

_PATTERN_STOP_PATTERNS = {"hammer", "bullish_engulfing", "inside_bar"}
_PATTERN_STOP_CONTEXTS = {"at_breakout", "at_pullback"}


def apply_pattern_stop(
    *,
    ticker: str,
    entry: float,
    current_stop: float | None,
    atr: float | None,
    patterns: dict[str, list[CandlePattern]],
    buffer_atr: float,
    min_rr_stop: float | None,
) -> tuple[float | None, str | None]:
    """Return a tighter structural stop derived from a bullish pattern on the
    latest bar, or (None, None) to keep the existing stop. Never returns a stop
    that is wider than current, above entry, in an 'extended' context, or below
    `min_rr_stop` (the lowest stop that still satisfies minimum R)."""
    pats = patterns.get(ticker) or patterns.get(str(ticker).upper()) or []
    candidates = [
        p for p in pats
        if p.name in _PATTERN_STOP_PATTERNS and p.context in _PATTERN_STOP_CONTEXTS
    ]
    if not candidates or atr is None or atr <= 0:
        return None, None

    # Use the highest key_level -> tightest stop among eligible patterns.
    best = max(candidates, key=lambda p: p.key_level)
    pattern_stop = round(best.key_level - buffer_atr * atr, 4)

    if pattern_stop >= entry:
        return None, None
    if current_stop is not None and pattern_stop <= current_stop:
        return None, None  # not tighter
    if min_rr_stop is not None and pattern_stop < min_rr_stop:
        return None, None  # would break minimum R

    reason = f"Stop below {best.name.replace('_', ' ')} low ({best.context.replace('_', ' ')})"
    return pattern_stop, reason
```

Add to `ExecutionConfig`:

```python
    pattern_stop_enabled: bool = field(default_factory=lambda: bool(_execution_defaults().get("pattern_stop_enabled", True)))
    pattern_stop_atr_buffer: float = field(default_factory=lambda: float(_execution_defaults().get("pattern_stop_atr_buffer", 0.25)))
```

Add to `config/defaults.yaml` under `low_level.execution`:

```yaml
    pattern_stop_enabled: true
    pattern_stop_atr_buffer: 0.25
```

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_execution_guidance.py -k pattern_stop -q`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/execution/guidance.py tests/test_execution_guidance.py config/defaults.yaml
git commit -m "feat(execution): structural pattern_stop helper with R guard-rails"
```

---

## Phase 3 — API plumbing

### Task 6: Extend API models

**Files:**
- Modify: `api/models/screener.py`
- Test: `tests/` (pydantic round-trip) — add `tests/test_screener_models.py` if absent, else extend existing model test.

- [ ] **Step 1: Write failing test**

```python
# tests/test_screener_models.py
from api.models.screener import PriceHistoryPoint, CandlePatternOut


def test_price_history_point_optional_ohlcv_defaults_none():
    p = PriceHistoryPoint(date="2024-01-01", close=10.0)
    assert p.open is None and p.high is None and p.low is None and p.volume is None


def test_price_history_point_with_ohlcv():
    p = PriceHistoryPoint(date="2024-01-01", close=10.0, open=9.5, high=10.2, low=9.4, volume=1000)
    assert p.high == 10.2


def test_candle_pattern_out():
    cp = CandlePatternOut(bar_index=5, date="2024-01-01", name="hammer", direction="bullish", key_level=9.0, context="at_pullback")
    assert cp.name == "hammer"
```

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_screener_models.py -q`
Expected: FAIL — `ImportError: cannot import name 'CandlePatternOut'`

- [ ] **Step 3: Implement model changes**

In `api/models/screener.py`, replace `PriceHistoryPoint` and add `CandlePatternOut`:

```python
class PriceHistoryPoint(BaseModel):
    date: str
    close: float
    open: float | None = None
    high: float | None = None
    low: float | None = None
    volume: float | None = None


class CandlePatternOut(BaseModel):
    bar_index: int
    date: str
    name: str
    direction: str
    key_level: float
    context: str
```

In the `ScreenerCandidate` model add fields (keep existing fields intact):

```python
    patterns: list[CandlePatternOut] = Field(default_factory=list)
    pattern_stop: float | None = None
    pattern_stop_reason: str | None = None
```

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_screener_models.py -q`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add api/models/screener.py tests/test_screener_models.py
git commit -m "feat(api): OHLCV price points, CandlePatternOut, candidate pattern fields"
```

---

### Task 7: Emit OHLCV + patterns from screener_service

**Files:**
- Modify: `api/services/screener_service.py`
- Test: `tests/test_screener_service.py` (extend; if absent create with an integration-free unit around `_price_history_map`)

- [ ] **Step 1: Write failing test for `_price_history_map` OHLCV**

```python
# tests/test_screener_service.py
import pandas as pd
from api.services.screener_service import _price_history_map


def _ohlcv():
    idx = pd.date_range("2024-01-01", periods=3, freq="B")
    cols = pd.MultiIndex.from_tuples(
        [("Open", "AAA"), ("High", "AAA"), ("Low", "AAA"), ("Close", "AAA"), ("Volume", "AAA")],
        names=["field", "ticker"],
    )
    return pd.DataFrame(
        [[9.5, 10.2, 9.4, 10.0, 1000], [10.0, 10.5, 9.8, 10.3, 1200], [10.3, 10.6, 10.0, 10.4, 1100]],
        index=idx, columns=cols,
    )


def test_price_history_map_includes_ohlcv():
    out = _price_history_map(_ohlcv(), tickers=["AAA"])
    point = out["AAA"][0]
    assert point["close"] == 10.0
    assert point["open"] == 9.5
    assert point["high"] == 10.2
    assert point["low"] == 9.4
    assert point["volume"] == 1000
```

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_screener_service.py -k ohlcv -q`
Expected: FAIL — `KeyError: 'open'`

- [ ] **Step 3: Extend `_price_history_map`**

Replace the per-point dict build in `_price_history_map` so each point includes OHLCV when the fields exist:

```python
    out: dict[str, list[dict]] = {}
    if ohlcv is None or ohlcv.empty:
        return out
    levels = ohlcv.columns.get_level_values(0)
    if "Close" not in levels:
        return out

    def _sub(field: str):
        return ohlcv[field] if field in levels else None

    close = ohlcv["Close"]
    open_ = _sub("Open"); high = _sub("High"); low = _sub("Low"); vol = _sub("Volume")
    columns_to_process = close.columns if tickers is None else [t for t in tickers if t in close.columns]

    for ticker in columns_to_process:
        series = close[ticker].dropna()
        if series.empty:
            continue
        if max_bars > 0 and len(series) > max_bars:
            series = series.iloc[-max_bars:]
        points = []
        for ts, px in series.items():
            date = _to_date_iso(ts)
            if date is None:
                continue
            point = {"date": date, "close": float(px)}
            for key, frame in (("open", open_), ("high", high), ("low", low), ("volume", vol)):
                if frame is not None and ticker in frame.columns:
                    val = frame[ticker].get(ts)
                    if val is not None and pd.notna(val):
                        point[key] = float(val)
            points.append(point)
        if points:
            out[str(ticker)] = points
    return out
```

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_screener_service.py -k ohlcv -q`
Expected: PASS

- [ ] **Step 5: Compute + attach patterns and pattern_stop**

In the screening method, after `price_history_map = _price_history_map(...)`, add:

```python
            from swing_screener.indicators.candles import detect_patterns, CandleConfig
            from swing_screener.execution.guidance import apply_pattern_stop, ExecutionConfig

            patterns_map = detect_patterns(ohlcv, tickers=ticker_list, cfg=CandleConfig())
            exec_cfg = ExecutionConfig()
```

Where `ScreenerCandidate(...)` is built, add the fields. Compute pattern_stop using the candidate's `entry_val`, `stop_val`, and ATR (`row.get(atr_col)`):

```python
                cand_patterns = [
                    CandlePatternOut(
                        bar_index=p.bar_index, date=p.date, name=p.name,
                        direction=p.direction, key_level=p.key_level, context=p.context,
                    )
                    for p in patterns_map.get(ticker_str, [])
                ]
                pattern_stop_val, pattern_stop_reason = (None, None)
                if exec_cfg.pattern_stop_enabled and entry_val:
                    pattern_stop_val, pattern_stop_reason = apply_pattern_stop(
                        ticker=ticker_str, entry=entry_val, current_stop=stop_val,
                        atr=_safe_optional_float(row.get(atr_col)),
                        patterns=patterns_map, buffer_atr=exec_cfg.pattern_stop_atr_buffer,
                        min_rr_stop=None,
                    )
```

Add to the `ScreenerCandidate(...)` constructor call:

```python
                        patterns=cand_patterns,
                        pattern_stop=pattern_stop_val,
                        pattern_stop_reason=pattern_stop_reason,
```

Add the import near the other model imports at the top of the file:

```python
from api.models.screener import CandlePatternOut  # alongside existing screener model imports
```

- [ ] **Step 6: Run the broader service + candle tests**

Run: `pytest tests/test_screener_service.py tests/test_candles.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/services/screener_service.py tests/test_screener_service.py
git commit -m "feat(api): emit OHLCV history + candle patterns + pattern_stop in screener"
```

---

### Task 8: Watchlist plumbing

**Files:**
- Modify: `api/models/watchlist.py`, `api/services/watchlist_service.py`
- Test: `tests/test_watchlist_service.py` (extend)

- [ ] **Step 1: Write failing test**

```python
# tests/test_watchlist_service.py
from api.models.watchlist import WatchlistItem  # adjust to actual item class name


def test_watchlist_item_has_patterns_default():
    # Construct with minimal required fields per existing model; patterns defaults to []
    item = WatchlistItem.model_construct()
    assert getattr(item, "patterns", []) == []
```

(If `WatchlistItem` requires fields, build a minimal valid instance instead and assert `item.patterns == []`.)

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_watchlist_service.py -k patterns -q`
Expected: FAIL — `AttributeError`/validation: no `patterns`

- [ ] **Step 3: Add `patterns` to the watchlist item model**

In `api/models/watchlist.py`, on the watchlist item model add (import `CandlePatternOut` from `api.models.screener`):

```python
from api.models.screener import CandlePatternOut
...
    patterns: list[CandlePatternOut] = Field(default_factory=list)
```

In `watchlist_service.py`, `_sparkline_history_map` already builds close-only points — extend it the same way as `_price_history_map` (OHLCV per point), then compute `patterns_map = detect_patterns(ohlcv, tickers)` and pass `patterns=patterns_map.get(ticker, [])` mapped to `CandlePatternOut` when constructing each item.

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_watchlist_service.py -k patterns -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/models/watchlist.py api/services/watchlist_service.py tests/test_watchlist_service.py
git commit -m "feat(api): OHLCV history + candle patterns in watchlist"
```

---

## Phase 4 — LLM context

### Task 9: Feed patterns to symbol_analyzer prompt

**Files:**
- Modify: `src/swing_screener/intelligence/models.py`
- Modify: `src/swing_screener/intelligence/symbol_analyzer.py`
- Test: `tests/test_symbol_analyzer.py` (extend; assert prompt contains the block — no API call)

- [ ] **Step 1: Write failing test**

```python
# tests/test_symbol_analyzer.py
from swing_screener.intelligence.models import SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import _build_user_prompt


def test_prompt_includes_recent_patterns():
    req = SymbolIntelligenceRequest(
        close=10.0, signal="breakout", recent_patterns=["hammer@at_pullback", "inside_bar@none"],
    )
    prompt = _build_user_prompt("AAA", req, past_positions=[])
    assert "hammer" in prompt
    assert "Recent candlestick patterns" in prompt


def test_prompt_omits_patterns_when_absent():
    req = SymbolIntelligenceRequest(close=10.0, signal="breakout")
    prompt = _build_user_prompt("AAA", req, past_positions=[])
    assert "Recent candlestick patterns" not in prompt
```

- [ ] **Step 2: Run, verify fail**

Run: `pytest tests/test_symbol_analyzer.py -k patterns -q`
Expected: FAIL — `ValidationError`/no field `recent_patterns`

- [ ] **Step 3: Add field + render block**

In `intelligence/models.py` `SymbolIntelligenceRequest`:

```python
    recent_patterns: list[str] | None = None  # ["name@context", ...] for the LLM prompt
```

In `symbol_analyzer.py` `_build_user_prompt`, before the final return, add:

```python
    if req.recent_patterns:
        readable = ", ".join(p.replace("@", " @ ").replace("_", " ") for p in req.recent_patterns)
        lines.append(f"Recent candlestick patterns: {readable}")
```

(Use the prompt's existing line-accumulation variable — match the local name used in `_build_user_prompt`, e.g. `lines`/`parts`.)

- [ ] **Step 4: Run, verify pass**

Run: `pytest tests/test_symbol_analyzer.py -k patterns -q`
Expected: PASS

- [ ] **Step 5: Populate `recent_patterns` where the request is built**

Find where `SymbolIntelligenceRequest(...)` is constructed (intelligence service / API router building the request). Add, using the already-available `ohlcv`:

```python
from swing_screener.indicators.candles import detect_patterns
...
        pats = detect_patterns(ohlcv, tickers=[ticker]).get(ticker, [])
        recent_patterns = [f"{p.name}@{p.context}" for p in pats] or None
```

and pass `recent_patterns=recent_patterns` into the request. If the request is built without OHLCV in scope, skip population there (the field stays optional) and note it in the spec follow-ups.

- [ ] **Step 6: Run intelligence tests + commit**

Run: `pytest tests/test_symbol_analyzer.py -q`
Expected: PASS

```bash
git add src/swing_screener/intelligence/models.py src/swing_screener/intelligence/symbol_analyzer.py tests/test_symbol_analyzer.py
git commit -m "feat(intelligence): pass recent candle patterns into symbol prompt"
```

---

## Phase 5 — Frontend types + transforms

### Task 10: Frontend types

**Files:**
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/features/watchlist/types.ts`

- [ ] **Step 1: Extend `PriceHistoryPoint` + add `CandlePattern`**

In `web-ui/src/features/screener/types.ts`:

```ts
export interface PriceHistoryPoint {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface CandlePattern {
  barIndex: number;
  date: string;
  name: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  keyLevel: number;
  context: 'at_breakout' | 'at_pullback' | 'extended' | 'none';
}
```

On the camelCase candidate interface add:

```ts
  patterns?: CandlePattern[];
  patternStop?: number | null;
  patternStopReason?: string | null;
```

On the snake_case (raw API) candidate interface add:

```ts
  patterns?: CandlePatternRaw[];
  pattern_stop?: number | null;
  pattern_stop_reason?: string | null;
```

and the raw point/pattern shapes:

```ts
export interface CandlePatternRaw {
  bar_index: number;
  date: string;
  name: string;
  direction: string;
  key_level: number;
  context: string;
}
```

(Watchlist `types.ts`: add `patterns?` to its item interfaces, reusing the exported `CandlePattern`/`CandlePatternRaw` types.)

- [ ] **Step 2: Typecheck**

Run: `cd web-ui && npm run typecheck`
Expected: errors only where transforms don't yet map the new fields (fixed next task) — note them, do not treat unrelated passing files as failures.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/features/screener/types.ts web-ui/src/features/watchlist/types.ts
git commit -m "feat(web): candle OHLCV + pattern types"
```

---

### Task 11: Boundary transforms

**Files:**
- Modify: `web-ui/src/features/screener/api.ts`
- Modify: `web-ui/src/features/watchlist/api.ts`
- Test: `web-ui/src/features/screener/api.test.ts` (extend)

- [ ] **Step 1: Write failing test**

```ts
// web-ui/src/features/screener/api.test.ts
import { describe, it, expect } from 'vitest';
import { transformPriceHistoryPoint, transformCandlePattern } from './api';

describe('candle transforms', () => {
  it('maps ohlcv fields', () => {
    const p = transformPriceHistoryPoint({ date: '2024-01-01', close: 10, open: 9.5, high: 10.2, low: 9.4, volume: 1000 });
    expect(p).toEqual({ date: '2024-01-01', close: 10, open: 9.5, high: 10.2, low: 9.4, volume: 1000 });
  });

  it('maps pattern snake_case to camelCase', () => {
    const c = transformCandlePattern({ bar_index: 5, date: '2024-01-01', name: 'hammer', direction: 'bullish', key_level: 9, context: 'at_pullback' });
    expect(c).toEqual({ barIndex: 5, date: '2024-01-01', name: 'hammer', direction: 'bullish', keyLevel: 9, context: 'at_pullback' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd web-ui && npx vitest run src/features/screener/api.test.ts -t "candle"`
Expected: FAIL — `transformCandlePattern is not exported`

- [ ] **Step 3: Implement transforms**

In `web-ui/src/features/screener/api.ts`:

```ts
import type { PriceHistoryPoint, CandlePattern, CandlePatternRaw } from './types';

export function transformPriceHistoryPoint(raw: {
  date: string; close: number; open?: number; high?: number; low?: number; volume?: number;
}): PriceHistoryPoint {
  return {
    date: raw.date,
    close: raw.close,
    ...(raw.open != null ? { open: raw.open } : {}),
    ...(raw.high != null ? { high: raw.high } : {}),
    ...(raw.low != null ? { low: raw.low } : {}),
    ...(raw.volume != null ? { volume: raw.volume } : {}),
  };
}

export function transformCandlePattern(raw: CandlePatternRaw): CandlePattern {
  return {
    barIndex: raw.bar_index,
    date: raw.date,
    name: raw.name,
    direction: raw.direction as CandlePattern['direction'],
    keyLevel: raw.key_level,
    context: raw.context as CandlePattern['context'],
  };
}
```

Wire them into the existing candidate transform: map `price_history`/`benchmark_price_history` through `transformPriceHistoryPoint`, map `patterns` through `transformCandlePattern`, and copy `pattern_stop`→`patternStop`, `pattern_stop_reason`→`patternStopReason`. Apply the same point/pattern mapping in `watchlist/api.ts`.

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `cd web-ui && npx vitest run src/features/screener/api.test.ts -t "candle" && npm run typecheck`
Expected: PASS, typecheck clean

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/features/screener/api.ts web-ui/src/features/watchlist/api.ts web-ui/src/features/screener/api.test.ts
git commit -m "feat(web): transform OHLCV + candle patterns at API boundary"
```

---

## Phase 6 — CandleChart component

### Task 12: i18n labels

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add keys**

Add (follow the file's existing nesting style — flat dotted keys or nested object as used):

```ts
  'chart.pattern.hammer': 'Hammer',
  'chart.pattern.shooting_star': 'Shooting star',
  'chart.pattern.bullish_engulfing': 'Bullish engulfing',
  'chart.pattern.bearish_engulfing': 'Bearish engulfing',
  'chart.pattern.inside_bar': 'Inside bar',
  'chart.pattern.outside_bar': 'Outside bar',
  'chart.pattern.doji': 'Doji',
  'chart.context.at_breakout': 'at breakout',
  'chart.context.at_pullback': 'at pullback',
  'chart.context.extended': 'extended',
  'chart.context.none': '',
  'chart.volume': 'Volume',
```

- [ ] **Step 2: Typecheck (i18n key type)**

Run: `cd web-ui && npm run typecheck`
Expected: PASS (keys registered in the message type)

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts
git commit -m "feat(web): i18n labels for candle patterns and contexts"
```

---

### Task 13: CandleChart component

**Files:**
- Create: `web-ui/src/components/domain/market/CandleChart.tsx`
- Test: `web-ui/src/components/domain/market/CandleChart.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// web-ui/src/components/domain/market/CandleChart.test.tsx
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils'; // adjust to project's helper path
import { CandleChart } from './CandleChart';
import type { PriceHistoryPoint, CandlePattern } from '@/features/screener/types';

const bars: PriceHistoryPoint[] = [
  { date: '2024-01-01', open: 9.5, high: 10.2, low: 9.4, close: 10.0, volume: 1000 },
  { date: '2024-01-02', open: 10.0, high: 10.6, low: 9.9, close: 9.8, volume: 1200 },
];

describe('CandleChart', () => {
  it('renders one candle body per bar', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    expect(document.querySelectorAll('[data-testid="candle-body"]').length).toBe(2);
  });

  it('colors up vs down candles differently', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    const bodies = document.querySelectorAll('[data-testid="candle-body"]');
    expect(bodies[0].getAttribute('data-direction')).toBe('up');   // close>open
    expect(bodies[1].getAttribute('data-direction')).toBe('down'); // close<open
  });

  it('renders a pattern marker when patterns present', () => {
    const patterns: CandlePattern[] = [
      { barIndex: 1, date: '2024-01-02', name: 'hammer', direction: 'bullish', keyLevel: 9.4, context: 'at_pullback' },
    ];
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={patterns} />);
    expect(document.querySelectorAll('[data-testid="pattern-marker"]').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd web-ui && npx vitest run src/components/domain/market/CandleChart.test.tsx`
Expected: FAIL — cannot resolve `./CandleChart`

- [ ] **Step 3: Implement CandleChart (hand SVG)**

```tsx
// web-ui/src/components/domain/market/CandleChart.tsx
import { useMemo } from 'react';
import type { PriceHistoryPoint, CandlePattern } from '@/features/screener/types';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

interface CandleChartProps {
  ticker: string;
  bars: PriceHistoryPoint[];
  patterns: CandlePattern[];
  className?: string;
  width?: number;
  height?: number;
}

const PAD = 8;
const VOL_FRACTION = 0.2;

export function CandleChart({ ticker, bars, patterns, className, width = 640, height = 320 }: CandleChartProps) {
  const usable = bars.filter((b) => b.open != null && b.high != null && b.low != null);
  const priceH = height * (1 - VOL_FRACTION) - PAD * 2;
  const volTop = height * (1 - VOL_FRACTION);
  const volH = height * VOL_FRACTION - PAD;

  const bounds = useMemo(() => {
    const highs = usable.map((b) => b.high as number);
    const lows = usable.map((b) => b.low as number);
    return { max: Math.max(...highs), min: Math.min(...lows) };
  }, [usable]);

  const maxVol = useMemo(() => Math.max(1, ...usable.map((b) => b.volume ?? 0)), [usable]);

  if (usable.length === 0) {
    return <div className={className}>{ticker}</div>;
  }

  const slotW = (width - PAD * 2) / usable.length;
  const candleW = Math.max(1, slotW * 0.6);
  const yPrice = (v: number) => {
    const range = bounds.max - bounds.min || 1;
    return PAD + (1 - (v - bounds.min) / range) * priceH;
  };

  return (
    <svg className={cn(className)} width={width} height={height} role="img" aria-label={`${ticker} candles`}>
      {usable.map((b, i) => {
        const x = PAD + i * slotW + slotW / 2;
        const o = b.open as number; const c = b.close; const h = b.high as number; const l = b.low as number;
        const up = c >= o;
        const bodyTop = yPrice(Math.max(o, c));
        const bodyBot = yPrice(Math.min(o, c));
        const colorClass = up ? 'fill-emerald-500 stroke-emerald-500' : 'fill-rose-500 stroke-rose-500';
        const vol = b.volume ?? 0;
        const vh = (vol / maxVol) * volH;
        return (
          <g key={b.date}>
            <line x1={x} x2={x} y1={yPrice(h)} y2={yPrice(l)} className={colorClass} strokeWidth={1} />
            <rect
              data-testid="candle-body"
              data-direction={up ? 'up' : 'down'}
              x={x - candleW / 2}
              y={bodyTop}
              width={candleW}
              height={Math.max(1, bodyBot - bodyTop)}
              className={colorClass}
            />
            <rect x={x - candleW / 2} y={volTop + (volH - vh)} width={candleW} height={vh} className={cn(colorClass, 'opacity-40')} />
          </g>
        );
      })}
      {patterns.map((p) => {
        const i = usable.findIndex((b) => b.date === p.date);
        if (i < 0) return null;
        const x = PAD + i * slotW + slotW / 2;
        const label = [t(`chart.pattern.${p.name}` as never), t(`chart.context.${p.context}` as never)].filter(Boolean).join(' · ');
        return (
          <g key={`${p.name}-${p.date}`} data-testid="pattern-marker">
            <polygon points={`${x - 4},${yPrice(p.keyLevel) + 10} ${x + 4},${yPrice(p.keyLevel) + 10} ${x},${yPrice(p.keyLevel) + 2}`} className="fill-sky-400" />
            <title>{label}</title>
          </g>
        );
      })}
    </svg>
  );
}
```

(Adjust `cn`, `t`, and `renderWithProviders` import paths to the project's actual locations; reuse the same color tokens `CachedSymbolPriceChart` uses if they differ from `emerald/rose`.)

- [ ] **Step 4: Run, verify pass**

Run: `cd web-ui && npx vitest run src/components/domain/market/CandleChart.test.tsx`
Expected: PASS (3 passed)

- [ ] **Step 5: Lint + commit**

```bash
cd web-ui && npm run lint
git add web-ui/src/components/domain/market/CandleChart.tsx web-ui/src/components/domain/market/CandleChart.test.tsx
git commit -m "feat(web): SVG CandleChart with volume + pattern markers"
```

---

## Phase 7 — Wire into views

### Task 14: Swap line chart for CandleChart in full views

**Files:**
- Modify: `web-ui/src/components/domain/workspace/WorkspaceSymbolModal.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- Test: existing tests for those components (update assertions)

- [ ] **Step 1: Read both files**

Read each to find where `<CachedSymbolPriceChart .../>` renders and what price-history prop is in scope (it currently passes close-only history via the screener store; confirm OHLCV bars + patterns are available from the candidate/intelligence data the modal already has).

- [ ] **Step 2: Replace usage**

Swap the full-view `CachedSymbolPriceChart` for:

```tsx
<CandleChart ticker={ticker} bars={priceHistory} patterns={patterns ?? []} />
```

Keep `CachedSymbolPriceChart` imported/used **only** in the compact screener candidate row (`ScreenerCandidateDetailsRow.tsx`) — do not change that file.

- [ ] **Step 3: Update component tests**

Adjust the modal/analysis tests to assert the candle SVG renders (e.g. query `aria-label` `${ticker} candles`) instead of the old polyline. Keep i18n-sourced assertions.

- [ ] **Step 4: Run web tests + typecheck + lint**

Run: `cd web-ui && npm test && npm run typecheck && npm run lint`
Expected: PASS, zero lint warnings

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/WorkspaceSymbolModal.tsx web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx web-ui/src/components/domain/workspace/*.test.tsx
git commit -m "feat(web): use CandleChart in symbol modal + analysis views"
```

---

## Phase 8 — Docs + full suite

### Task 15: Update documentation

**Files:**
- Modify: `config/README.md`, `api/README.md`, `web-ui/docs/WEB_UI_GUIDE.md`, `src/swing_screener/intelligence/README.md`, `data/README.md`, `docs/overview/INDEX.md`

- [ ] **Step 1: Update each doc**

- `config/README.md`: document `low_level.candles` block and `low_level.execution.pattern_stop_enabled` / `pattern_stop_atr_buffer`.
- `api/README.md`: `PriceHistoryPoint` now carries optional OHLCV; candidate/watchlist gain `patterns`, `pattern_stop`, `pattern_stop_reason`.
- `web-ui/docs/WEB_UI_GUIDE.md`: new `CandleChart` (full views); sparkline `CachedSymbolPriceChart` retained in compact rows.
- `intelligence/README.md`: `recent_patterns` request field feeds the prompt.
- `data/README.md`: price-history payload gained optional OHLCV (backward-compatible, no migration of persisted state required) — note it.
- `docs/overview/INDEX.md`: link the spec `2026-06-14-candlestick-chart-pattern-reader-design.md`.

- [ ] **Step 2: Run full suite**

Run: `pytest -q && cd web-ui && npm test && npm run typecheck && npm run lint`
Expected: all green

Run: `cd .. && ruff check . && black --check .`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add config/README.md api/README.md web-ui/docs/WEB_UI_GUIDE.md src/swing_screener/intelligence/README.md data/README.md docs/overview/INDEX.md
git commit -m "docs: candle chart + pattern reader (config, api, web, intelligence, data)"
```

---

## Self-Review Notes

- **Spec coverage:** engine (Tasks 1–4), entry/stop (Task 5), OHLC plumbing + patterns (Tasks 6–8), LLM context (Task 9), frontend types/transforms (Tasks 10–11), CandleChart + i18n (Tasks 12–13), view wiring keeping sparkline in rows (Task 14), docs (Task 15). Ranking untouched — no task modifies ranking/setup-score code.
- **Type consistency:** `CandlePattern` (core) → `CandlePatternOut` (api) → `CandlePatternRaw`/`CandlePattern` (web). `apply_pattern_stop` signature identical across Task 5 (def) and Task 7 (call). `detect_patterns` signature identical across Tasks 4, 7, 8, 9.
- **Known soft spots to verify during execution (not placeholders):** exact local variable name for the prompt line list in `_build_user_prompt`; exact watchlist item class name; project's test-utils import path; whether the symbol modal already has OHLCV bars + patterns in scope or needs them threaded from the candidate/intelligence payload (Task 14 Step 1 verifies).
```
