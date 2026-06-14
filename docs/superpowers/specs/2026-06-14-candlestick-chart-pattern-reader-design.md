# Candlestick Chart + Deterministic Pattern Reader — Design

**Date:** 2026-06-14
**Branch:** `feat/candlestick-chart-pattern-reader` (from `feat/index-universes-wikipedia`)
**Status:** Approved design, pre-implementation

## Problem & Value

The screener already reads a lot of price action, but expressed as continuous
features (`consolidation_tightness`, `close_location_in_range`,
`above_breakout_extension`, exhaustion, trend, momentum) and the existing chart is
a **close-only line chart** (`CachedSymbolPriceChart`, hand-rolled SVG, fed by
`PriceHistoryPoint {date, close}`). Two things are currently invisible:

1. **Open price and intrabar wicks** — never used anywhere. Candlestick patterns
   (engulfing, inside/outside bar, hammer, doji) are precisely about
   open/close bodies and high/low wicks.
2. **Visual legibility for the human** — execution is manual; abstract scores
   (`setup_score 78`, `consolidation_tightness 0.71`) are harder to act on than a
   candle chart with a named pattern at a level.

**Where this adds value:** chart legibility (biggest), entry/stop precision
(second order), and richer LLM narrative. **Where it does NOT:** ranking / setup
score — left untouched on purpose. Isolated candlestick patterns have weak
standalone edge; they only matter in the context the pipeline already computes
(extension, base tightness, level, volume). Forcing them into the score would be
the curve-fitting the project forbids.

## Locked Decisions

- Ship candle chart **and** pattern reader together (one iteration).
- Replace the line chart **everywhere** (mini in list rows, full in symbol modal).
- **Hand-rolled SVG**, no charting library dependency.
- Curated set of ~6 patterns: hammer, shooting star, bullish/bearish engulfing,
  inside bar, outside bar, doji.
- Output channels: **chart annotations**, **LLM context**, **entry/stop
  refinement**. NOT a separate suggestion chip. NOT ranking.
- Pattern `context` computed **inside** the engine so all consumers get it
  identically.
- Volume **included** in payload and drawn as bars under the candles.
- Two `max_bars` values: short for list/mini candles, long for the modal.

## Architecture

```
core lib                        api                         web-ui
─────────                       ───                         ──────
indicators/candles.py   ──┐     models: PriceHistoryPoint   features/screener/types.ts
  detect_patterns(ohlcv)   │       + open/high/low/volume     PriceHistoryPoint + ohlc/vol
  → CandlePattern[]        ├──►  screener_service             + patterns
                           │     _price_history_map()        components/.../CandleChart.tsx
execution/guidance.py  ◄──┤       adds ohlc + patterns         (SVG, mini + full)
  structural stop          │                                   replaces CachedSymbolPriceChart
                           │     symbol_analyzer prompt
intelligence/             ◄┘       + candle/pattern block
  symbol_analyzer
```

Single source of truth: `indicators/candles.py`. Three consumers — chart payload
(API → CandleChart), LLM prompt, execution guidance. No ranking/setup-score hook.
Pure deterministic functions: OHLCV in, patterns out, no state, no I/O.

## Component 1 — Pattern engine (`src/swing_screener/indicators/candles.py`)

Pure functions, no library. Return type:

```python
@dataclass(frozen=True)
class CandlePattern:
    ticker: str
    bar_index: int          # position in the recent-bars series
    date: str               # ISO
    name: str               # hammer | shooting_star | bullish_engulfing |
                            # bearish_engulfing | inside_bar | outside_bar | doji
    direction: str          # bullish | bearish | neutral
    key_level: float        # structural level: hammer low / inside-bar low / etc.
    context: str            # at_breakout | at_pullback | extended | none
```

Deterministic rules (thresholds in `config/`, never hardcoded), using O/H/L/C:

- **hammer**: small body near top, lower wick ≥ 2× body, small upper wick.
  `key_level = low`.
- **shooting_star**: mirror of hammer at top. `key_level = high`.
- **bullish/bearish_engulfing**: bar N body engulfs bar N-1 body, opposite
  direction. `key_level = low/high` of the engulfing bar.
- **inside_bar**: bar N H/L inside bar N-1 H/L. `key_level = low` (long bias).
- **outside_bar**: bar N H/L contains bar N-1 H/L.
- **doji**: body ≈ 0 vs range → `direction = neutral` (indecision).

`context` reuses what the pipeline already computes: `breakout_signal` /
`pullback_reclaim_signal` (`selection/entries.py`) and exhaustion /
`above_breakout_extension`. A hammer `at_pullback` weighs differently from a
hammer `extended`. No invented edge — only links pattern to existing context.

Public API:

```python
def detect_patterns(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str] | None = None,
    *,
    lookback: int = 10,
    cfg: CandleConfig = CandleConfig(),
) -> dict[str, list[CandlePattern]]
```

Thresholds (body/wick ratios, doji epsilon, lookback) live in a `config/` block,
documented in `config/README.md`.

## Component 2 — Data flow & OHLC plumbing

Today only `close` travels. Extend backward-compatibly (optional fields, no break).

**`api/models/screener.py`:**

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

`ScreenerCandidate` / watchlist item gain `patterns: list[CandlePatternOut] = []`.

**`screener_service._price_history_map`**: currently emits only `Close`. Extend to
emit O/H/L/Volume per bar (same `max_bars`, same slicing). Call
`detect_patterns(ohlcv, ...)` once for the ticker batch and attach patterns to
each candidate. Same hook in `watchlist_service`.

**Two `max_bars`**: short value for list/mini candles, long for the modal, to cap
payload cost (O/H/L/V ~4× close-only weight).

**Frontend `features/screener/types.ts`**: `PriceHistoryPoint` gains
`open/high/low/volume?`; candidate gains `patterns?: CandlePattern[]`. Transform at
the snake↔camel boundary with existing functions, **same commit** (cross-layer
contract rule).

## Component 3 — Frontend `CandleChart` (SVG)

New `components/domain/market/CandleChart.tsx`, **replaces** `CachedSymbolPriceChart`
in all 3 usages (symbol modal, symbol analysis content, screener candidate row).
Two modes via prop:

```tsx
<CandleChart ticker bars patterns mode="mini" | "full" range={PriceRangeKey} />
```

- **mini** (list rows, ~220×72 as now): thin candles, no axes, no volume, pattern
  marker as a colored dot on the latest relevant bar. Reuses `slicePriceHistory` +
  `getDefaultPriceRange`.
- **full** (modal): candles + volume bars below + price axis on the right + range
  selector (ranges already in `priceHistory.ts`) + pattern markers above candles
  with tooltip (`name` + `context`, e.g. "Inside bar · at pullback").

Rendering: hand SVG, price scale from visible H/L min/max (extend `getValueBounds`
for O/H/L). Body = rect open→close, wick = line high→low, green/red by
close≷open. Marker = small triangle/label anchored at `key_level`.

i18n: pattern names and context labels go through `web-ui/src/i18n/` (no hardcoded
strings). Keys like `chart.pattern.hammer`, `chart.context.atPullback`.

Colors from existing theme tokens reused from `CachedSymbolPriceChart`.

`CachedSymbolPriceChart` is **removed**; the 3 importers and their tests updated.
`WEB_UI_GUIDE.md` updated if the feature map changes.

## Component 4 — Entry/stop refinement (`execution/guidance.py`)

In `add_execution_guidance`, where stops/bands derive from
`breakout_level`/MA/ATR. The pattern does **not** replace the ATR stop; it adds a
**structural alternative** when a relevant pattern sits on the chosen level.

Deterministic rule:

- Bullish pattern (`hammer`, `bullish_engulfing`, `inside_bar`) with
  `context ∈ {at_breakout, at_pullback}` on the latest bar →
  `structure_stop = key_level − buffer` (buffer = ATR fraction, from config).
- Expose both: current stop (existing ATR/structure) and `structure_stop`.
  **Chosen = max(current_stop, structure_stop)** if tighter yet still below entry
  with healthy R; otherwise keep the ATR stop and note only the pattern level.
- New guidance board columns: `pattern_stop` (float, nullable),
  `pattern_stop_reason` (e.g. "Stop below hammer low at pullback").

Guard-rails (anti curve-fitting):

- Never a pattern stop if `context = extended` (exhaustion zone → noise).
- Never tighten beyond the threshold that pushes R below the configured minimum —
  the R model stays sovereign.
- Fully deterministic and explainable: every `pattern_stop` carries its `reason`.

Config: `pattern_stop_atr_buffer` + `pattern_stop_enabled` flag in `config/`
(execution), documented in `config/README.md`.

Propagation: `pattern_stop`/`reason` become optional candidate API + FE type fields
(same commit), shown in the modal next to the suggested stop. `build_recommendation`
unchanged — it receives the already-chosen `stop`.

## Component 5 — LLM context (`intelligence/symbol_analyzer.py`)

Feed the recent candle sequence + detected patterns into the user prompt so the
narrative reflects price action. Additive, low risk. Documented in
`intelligence/README.md` (prompt change).

## Testing

**Core (`indicators/candles.py`)** — the bulk of coverage, deterministic:
- One test per pattern with hand-built synthetic OHLCV (exact hammer, exact
  engulfing, inside/outside, doji epsilon). Positive + boundary-negative cases
  (wick ratio just under threshold → no hammer).
- `context` tests: same pattern with/without breakout/pullback/extension →
  correct context (reuse `entries`/`exhaustion`-style fixtures).
- Edge: too-short series, NaN, missing ticker → no crash, empty list.

**Execution (`guidance.py`)**:
- `pattern_stop` only with right pattern+context; never if `extended`; never if it
  violates minimum R; `max(...)` picks the tighter valid one.
- Nullable when no pattern.

**API**: `_price_history_map` emits O/H/L/V + `patterns` per candidate;
backward-compatible (optional fields). MSW handlers updated.

**Frontend (Vitest)**:
- `CandleChart` mini + full: renders N candles from `bars`, green/red by
  close≷open, marker present when `patterns` non-empty, range selector changes
  slice. Copy asserted via i18n keys.
- Existing coverage thresholds (80% lines / 75% branches) hold.

**Full suite before commit**: `pytest -q && cd web-ui && npm test`, plus
`ruff`/`black` and `npm run lint`/`typecheck`.

## Docs checklist (CLAUDE.md)

- `config/README.md` — new candle + execution thresholds.
- `data/README.md` — if persisted price-history schema changes.
- `api/README.md` — payload signature changes.
- `web-ui/docs/WEB_UI_GUIDE.md` — new CandleChart, removed CachedSymbolPriceChart.
- `src/swing_screener/indicators/` README (if present) — new module.
- `src/swing_screener/intelligence/README.md` — enriched prompt.
- `docs/overview/INDEX.md` — this spec.

## Non-goals

- No change to ranking / setup score.
- No charting library dependency.
- No predictive "next price" output — deterministic pattern + context only.
- No extended TA-Lib-style pattern library.
