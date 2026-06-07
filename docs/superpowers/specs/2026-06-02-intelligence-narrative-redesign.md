# Intelligence Narrative Redesign + Past Trades Benchmark

**Date:** 2026-06-02
**Branch:** ux/low-impact (or new branch off main)
**Status:** Approved for implementation

## Problem

The AI rationale section renders a single prose markdown blob. It's hard to scan, buries key numbers inside sentences, and has no visual hierarchy. There is also no use of historical trade data for the same ticker, which the system already has in `positions.json`.

## Goals

1. Richer structured LLM output — new fields replace the prose blob as the primary visual experience.
2. Past closed positions for the ticker are fed to the LLM to calibrate conviction and prediction.
3. Old cached results degrade gracefully — existing `narrative` field still renders in a collapsed section.

## Non-goals

- Replace `narrative` entirely (kept for fallback).
- Intraday or live-price enrichment.
- Any new data sources beyond what is already in `positions.json`.

---

## Backend Changes

### 1. New fields in `SymbolIntelligence` (`src/swing_screener/intelligence/models.py`)

```python
class KeyNumber(BaseModel):
    label: str
    value: str
    sentiment: Literal["bullish", "bearish", "neutral"]

class PredictionBullet(BaseModel):
    direction: Literal["bullish", "bearish", "neutral"]
    reason: str
    reference: str  # short source label e.g. "SMA20 support", "Q1 earnings"

class SymbolIntelligence(BaseModel):
    # existing fields unchanged ...
    price_hook: str | None = None
    key_numbers: list[KeyNumber] = []
    risk_factors: list[str] = []
    prediction_bullets: list[PredictionBullet] = []
    past_trades_context: str | None = None
```

All new fields are optional with defaults — backward-compatible with cached JSON.

### 2. System prompt extension (`symbol_analyzer.py`)

Add to the JSON field spec in `_SYSTEM_PROMPT`:

```
- price_hook: one sentence — why this symbol, why now (max 140 chars)
- key_numbers: 4–8 objects {label, value, sentiment}. Pick the most decision-relevant numbers:
  SMAs, momentum, revenue growth, valuation label, relative strength, 52w high proximity.
  sentiment: bullish | bearish | neutral based on what the value implies for the trade.
- risk_factors: 3–5 strings, each a concrete risk to the thesis. No fluff.
- prediction_bullets: 2–5 objects {direction, reason, reference}.
  direction: bullish | bearish | neutral.
  reason: one sentence explaining what supports that direction.
  reference: short label for the data point or event behind the reason.
  If past trades are provided, at least one bullet must reference them.
- past_trades_context: null unless past trades are provided. One paragraph: what the pattern
  of past trades on this ticker tells us about the current setup. Be concrete — name levels,
  outcomes, patterns. Use this to calibrate conviction in your action/conviction fields.
```

Add to `_SYSTEM_PROMPT` behavioural rules:

```
PAST TRADES RULE:
If a "Past trades" block is present:
  - Analyse the pattern of entries, outcomes, and stop levels.
  - If 2+ stop-outs occurred near the same price level, lower conviction by one step and
    flag that level in past_trades_context.
  - If there is a prior win on this ticker, note the setup similarity/difference.
  - Always populate past_trades_context (not null) when past trades are present.
```

### 3. User prompt injection (`symbol_analyzer.py` — `_build_user_prompt`)

Before returning the prompt, query closed positions for the ticker:

```python
def _format_past_trades(past_positions: list[dict]) -> str | None:
    closed = [p for p in past_positions if p.get("status") == "closed" and p.get("exit_price")]
    if not closed:
        return None
    lines = [f"--- Past trades on {closed[0]['ticker']} ---"]
    for p in closed:
        entry = p["entry_price"]
        stop = p["stop_price"]
        exit_p = p["exit_price"]
        r = (exit_p - entry) / (entry - stop) if (entry - stop) != 0 else 0
        entry_date = p.get("entry_date") or "?"
        exit_date = p.get("exit_date") or "?"
        outcome = "stopped out" if exit_p <= stop else "target/manual exit"
        r_sign = "+" if r >= 0 else ""
        lines.append(f"  Trade: {entry_date}→{exit_date} | entry {entry:.2f} → exit {exit_p:.2f} | {r_sign}{r:.2f}R | {outcome}")
    return "\n".join(lines)
```

The past trades block is appended to the user prompt after the decision context block.

### 4. Router change (`api/routers/intelligence.py`)

When handling `POST /api/intelligence/{ticker}`:
- Load all positions from `PositionsRepository`
- Filter to `ticker` (case-insensitive)
- Pass the filtered list to `_build_user_prompt` via a new optional param `past_positions: list[dict] = []`

No new API endpoints. No schema changes to `positions.json`.

---

## Frontend Changes

### 1. New types (`web-ui/src/features/intelligence/types.ts`)

```typescript
export interface KeyNumber {
  label: string;
  value: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface PredictionBullet {
  direction: 'bullish' | 'bearish' | 'neutral';
  reason: string;
  reference: string;
}
```

Add to `SymbolIntelligenceAPI` (snake_case from API):
```typescript
price_hook?: string | null;
key_numbers?: KeyNumber[];       // same shape, no transform needed
risk_factors?: string[];
prediction_bullets?: PredictionBullet[];  // same shape, no transform needed
past_trades_context?: string | null;
```

Add to `SymbolIntelligence` (camelCase, post-transform) — same fields, already camelCase.

`transformIntelligence` passes them through with `?? []` / `?? null` defaults.

### 2. `NarrativeAnalysisCard.tsx` — redesigned layout

Vertical stack of sections, each rendered only when data present:

```
[banner] SYMBOL — Action                    [Conviction]

  WHY NOW
  <price_hook>

  KEY NUMBERS
  [chip chip chip chip]  (colour-coded by sentiment)

  PREDICTION
  ↑ reason  [ref tag]
  ↓ reason  [ref tag]

  RISKS
  • risk factor
  • risk factor

  PAST TRADES ON {ticker}
  <past_trades_context paragraph>

  ▸ Full rationale  (collapsed — shows narrative prose)
  ▸ Signals detail  (existing collapsed section, unchanged)
  ▸ Data inputs     (existing collapsed section, unchanged)
```

Chip colours: bullish = green-100/green-700, bearish = rose-100/rose-700, neutral = slate-100/slate-600.
Direction arrows: ↑ bullish, ↓ bearish, → neutral.

Old cached results (missing new fields): WHY NOW / KEY NUMBERS / PREDICTION / RISKS / PAST TRADES sections are all absent. "Full rationale" `<details>` is `open` by default (i.e. `defaultOpen={!intelligence.priceHook}`) so the prose is visible without an extra click.

### 3. i18n keys (add to `web-ui/src/i18n/messages.en.ts`)

```
workspacePage.panels.analysis.intelligence.priceHook: "Why now"
workspacePage.panels.analysis.intelligence.keyNumbers: "Key numbers"
workspacePage.panels.analysis.intelligence.prediction: "Prediction"
workspacePage.panels.analysis.intelligence.riskFactors: "Risks"
workspacePage.panels.analysis.intelligence.pastTrades: "Past trades on {{symbol}}"
workspacePage.panels.analysis.intelligence.fullRationale: "Full rationale"
```

---

## Backward Compatibility

| Scenario | Behaviour |
|---|---|
| Old cached result (no new fields) | New sections absent, narrative expanded by default |
| New result, no past trades | `past_trades_context` null, past trades section hidden |
| New result, with past trades | All sections rendered |

---

## Testing

**Backend:**
- Unit test `_format_past_trades` with empty list, one trade, multiple trades including stop-outs at same level.
- Unit test that new fields parse correctly from mock LLM JSON.
- Integration test skipped (requires OpenAI key).

**Frontend:**
- `NarrativeAnalysisCard` test: renders all new sections when new fields present.
- `NarrativeAnalysisCard` test: renders gracefully when new fields absent (old cache).
- `NarrativeAnalysisCard` test: `narrative` expanded by default when no `price_hook`.
