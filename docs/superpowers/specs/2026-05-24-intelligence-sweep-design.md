# Intelligence Sweep Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing on-demand `SymbolAnalyzer` to return richer structured output (upcoming events, catalyst urgency, position management signal) and add a daily-review-triggered sweep that caches results per symbol per day.

**Architecture:** Same `SymbolAnalyzer` class and `SymbolIntelligence` model — extended, not replaced. Optional position fields on the request activate a position-management section in the prompt. Results are cached to `data/intelligence/sweep_YYYY-MM-DD.json` after every analysis. A new sweep endpoint runs all watchlist + position symbols sequentially and writes to the same cache.

**Tech stack:** Python/FastAPI backend, Pydantic v2 models, OpenAI Responses API (existing), React + React Query frontend, date-keyed JSON cache (consistent with existing `data/intelligence/` pattern).

---

## Data Models

### Extended `SymbolIntelligenceRequest`

```python
class SymbolIntelligenceRequest(BaseModel):
    close: float
    signal: str
    entry: float | None = None
    stop: float | None = None
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    momentum_6m: float | None = None
    momentum_12m: float | None = None
    sector: str | None = None
    currency: str = "USD"
    # Position context — triggers position_signal in response when present
    entry_price: float | None = None
    r_now: float | None = None
    days_open: int | None = None
```

### New types

```python
class IntelligenceEventType(str, Enum):
    earnings = "earnings"
    macro = "macro"
    dividend = "dividend"
    product_launch = "product_launch"
    regulatory = "regulatory"
    other = "other"

class IntelligenceEventDirection(str, Enum):
    bullish = "bullish"
    bearish = "bearish"
    neutral = "neutral"

class IntelligenceEvent(BaseModel):
    type: IntelligenceEventType
    date: str | None = None          # ISO date, may be approximate or None
    direction: IntelligenceEventDirection
    summary: str                     # one sentence

class PositionSignalAction(str, Enum):
    HOLD = "HOLD"
    TRIM = "TRIM"
    EXIT = "EXIT"

class PositionSignal(BaseModel):
    action: PositionSignalAction
    reason: str                      # one sentence
```

### Extended `SymbolIntelligence`

```python
class SymbolIntelligence(BaseModel):
    symbol: str
    generated_at: str
    action: DecisionAction
    conviction: DecisionConviction
    catalyst_urgency: Literal["high", "medium", "low", "none"]
    summary_line: str
    narrative: str
    upcoming_events: list[IntelligenceEvent] = []
    position_signal: PositionSignal | None = None
    sources: list[str] = []
```

---

## Prompt Changes

The system prompt is extended to always request `catalyst_urgency` and `upcoming_events`. When the user prompt includes position context (`entry_price`, `r_now`, `days_open`), an additional paragraph instructs the LLM to include `position_signal`:

**System prompt addition:**
```
Additionally include:
- catalyst_urgency: "high" | "medium" | "low" | "none" — how urgently this symbol needs attention
- upcoming_events: array of {type, date, direction, summary} for events that could move the price
- position_signal: null (omit unless position context is provided in the input)

If position context is provided (entry_price, r_now, days_open), add:
- position_signal: {action: "HOLD" | "TRIM" | "EXIT", reason: <one sentence>}
  HOLD = thesis intact, TRIM = take partial profit or reduce risk, EXIT = thesis broken or better use of capital
```

**User prompt addition** (when position fields present):
```
Position context: entry={entry_price}, current R={r_now:.2f}R, held {days_open} days
Given the above, include a position_signal recommendation.
```

---

## Cache

**File:** `data/intelligence/sweep_YYYY-MM-DD.json`
**Format:** `{ticker: SymbolIntelligence}` dict, written atomically after each analysis.

Rules:
- Written after every analysis (on-demand tab OR sweep)
- Read by `GET /api/intelligence/{ticker}/latest` — returns today's entry if present, else 404
- Stale entries from previous days are never served; the tab falls back to the Analyze button

Cache writer is a small helper in `src/swing_screener/intelligence/cache.py`:
```python
def write_to_cache(ticker: str, result: SymbolIntelligence, date: date | None = None) -> None: ...
def read_from_cache(ticker: str, date: date | None = None) -> SymbolIntelligence | None: ...
```

---

## API Endpoints

### Existing (unchanged behavior, extended response)
```
POST /api/intelligence/{ticker}
Body: SymbolIntelligenceRequest
Response: SymbolIntelligence  (now includes upcoming_events, catalyst_urgency, position_signal)
Side-effect: writes result to today's cache
```

### New: latest cached result
```
GET /api/intelligence/{ticker}/latest
Response: SymbolIntelligence  (today's cached entry)
         404 if no entry for today
```

### New: sweep
```
POST /api/intelligence/sweep
Body: SweepRequest {symbols: list[SweepSymbol]}
      SweepSymbol {ticker: str, request: SymbolIntelligenceRequest}
Response: SweepResponse {
    analyzed: list[str],          # tickers that succeeded
    failed: list[{ticker, error}] # tickers that failed
}
Behavior: runs symbols sequentially, writes each to cache as it completes,
          continues on per-symbol failure
```

---

## Frontend

### Intelligence tab (`SymbolAnalysisContent` + `IntelligenceCard`)

**On tab open:**
1. Call `GET /api/intelligence/{ticker}/latest`
2. If 200: render cached result immediately, show "Last analyzed: HH:MM" + small "Refresh" button
3. If 404: show existing Analyze button (unchanged)
4. Refresh button calls existing `POST /api/intelligence/{ticker}` mutation, updates local state + cache

**`IntelligenceCard` additions:**
- `catalyst_urgency` badge next to action/conviction: red=high, amber=medium, slate=low, hidden=none
- `upcoming_events` section: each event shows a type chip + date + direction arrow icon + summary line
- `position_signal` card (only when `position_signal !== null`): full-width colored card with action label (HOLD=yellow, TRIM=amber, EXIT=rose) + reason text

**New hook:** `useIntelligenceLatestQuery(ticker)` — React Query `useQuery` that calls `GET /api/intelligence/{ticker}/latest`. Enabled when Intelligence tab is active.

### Daily Review page

- New "Run Intelligence Sweep" button, secondary style, near the top of the daily review
- On click: calls `POST /api/intelligence/sweep` with all watchlist tickers + open position tickers
  - Open positions include `entry_price`, `r_now`, `days_open` in their `SymbolIntelligenceRequest`
  - Watchlist symbols get only technical context (no position fields)
- While running: button disabled, shows a spinner — the sweep is a single blocking POST, so progress is shown only on completion
- On complete: shows "Sweep complete — 12 analyzed, 0 failed" toast/inline message
- On partial failure: "Sweep complete — 10 analyzed, 2 failed (VALE, APAM)" with failed tickers listed

**New hook:** `useIntelligenceSweepMutation()` — `useMutation` wrapping `POST /api/intelligence/sweep`.

---

## Error Handling

- **Per-symbol sweep failure:** caught in the sweep endpoint, logged as warning, ticker added to `failed` list, sweep continues
- **OPENAI_API_KEY missing:** existing 503 guard on the analyze endpoint also applied to sweep
- **Cache write failure:** logged, not fatal — the API response still returns the result even if caching fails
- **Stale cache:** date-keyed files mean yesterday's data is never served; `latest` endpoint always checks today's date

---

## Testing

**Backend:**
- `test_prompt_builder_with_position_context` — assert `position_signal` section appears in user prompt when `entry_price`/`r_now`/`days_open` are set
- `test_prompt_builder_without_position_context` — assert `position_signal` section absent
- `test_cache_write_read_roundtrip` — write a result, read it back for the same ticker+date
- `test_cache_returns_none_for_different_date` — read returns None when date doesn't match
- `test_sweep_continues_on_failure` — mock one ticker to raise, assert sweep response includes it in `failed` and others in `analyzed`
- `test_latest_endpoint_404_when_no_cache` — no cache entry → 404
- `test_latest_endpoint_returns_today_entry` — cache has entry → 200

**Frontend:**
- Intelligence tab renders cached result when `useIntelligenceLatestQuery` returns data (no Analyze button shown)
- Intelligence tab renders Analyze button when query returns 404
- `IntelligenceCard` renders `upcoming_events` list
- `IntelligenceCard` renders `position_signal` card when present, nothing when null
- `catalyst_urgency` badge renders correct color variant
- Sweep button shows progress and completion message (MSW mock for `/api/intelligence/sweep`)
