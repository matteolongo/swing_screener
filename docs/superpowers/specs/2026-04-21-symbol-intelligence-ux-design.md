# Symbol Intelligence UX — Design Spec

**Date:** 2026-04-21  
**Branch:** feature/symbol-intelligence-ux  
**Status:** Approved, ready for implementation

---

## Problem

The screener surfaces previously-held symbols as fresh candidates without context. Open-position ADD_ON/MANAGE_ONLY labels are unclear. There is no re-entry discipline enforced in the UI. Past trade history on a symbol is not visible in the analysis flow.

## Goals

1. Auto-evaluate 7 re-entry conditions and suppress symbols that fail them.
2. Require a single manual confirmation before proceeding to order setup on any re-entry.
3. Surface past trade history inside the analysis canvas.
4. Make ADD_ON and MANAGE_ONLY status visually unambiguous with existing position context inline.

## Non-goals

- Persisting checklist answers
- Blocking re-entry on profitable exits only (informational, not a gate)
- ML-based thesis validation

---

## Section 1 — Backend: Screener Candidate Annotation

### New model: `PriorTradeContext`

Added to `api/models/screener.py`:

```python
class PriorTradeContext(BaseModel):
    last_exit_date: str
    last_exit_price: float
    last_entry_price: float
    last_r_outcome: float       # R multiple at exit (negative = loss)
    was_profitable: bool
    trade_count: int
```

Added to `ScreenerCandidate`:

```python
prior_trades: Optional[PriorTradeContext] = None
reentry_gate: Optional[ReentryGateResult] = None
```

### New model: `ReentryGateResult`

```python
class ReentryCheckResult(BaseModel):
    passed: bool
    reason: str

class ReentryGateResult(BaseModel):
    suppressed: bool            # True = do not show in screener
    checks: dict[str, ReentryCheckResult]  # keyed by rule name
```

### Annotation logic (in `ScreenerService`)

Runs after `SameSymbolReentryEvaluator`, before final candidate list is returned.

For each candidate whose ticker matches any closed position:
1. Attach `prior_trades` from most recent closed position for that ticker.
2. Evaluate re-entry gate rules (see Section 3).
3. If `reentry_gate.suppressed == True` → remove candidate from results.

### New endpoint: `GET /api/portfolio/symbol-history/{ticker}`

Returns all positions (open + closed) for a ticker, ordered by entry date descending.
Reuses `PortfolioService.get_positions()` filtered by ticker. No new storage needed.

Response schema:

```python
class SymbolHistoryResponse(BaseModel):
    ticker: str
    positions: list[PositionResponse]
    open_count: int
    closed_count: int
```

---

## Section 2 — Screener UX: Previously-Held Badges

### Re-entry candidates (closed position history)

In `ScreenerCandidateIdentityCell` and `CandidateItem` (Today page):

- Amber **`↩ Re-entry`** badge replaces or appends to signal badge
- Below badge: `"Last: +1.4R ✓"` (green) or `"Last: −1R ✗"` (red)
- If `trade_count > 1`: append `"· 3× traded"`

### ADD_ON (open position, add-on allowed)

- Row border-left: **amber** (currently blue for all candidates)
- Badge: `"ADD-ON · open @ $142.50"` showing existing entry price from `same_symbol.current_position_entry`
- Order setup available as normal

### MANAGE_ONLY (open position, no add-on)

- Row border-left: **gray**
- Badge: `"MANAGE ONLY"` in muted red
- Order setup button **not rendered** — clicking row opens analysis canvas only

---

## Section 3 — Re-entry Gate Rules + Confirmation Modal

### Auto-evaluated rules (backend, `ReentryGateEvaluator`)

| Key | Rule | Data source | Always passes |
|-----|------|-------------|---------------|
| `thesis_valid` | `recommendation.verdict == RECOMMENDED` + intelligence snapshot exists | recommendation, intelligence storage | No |
| `new_setup_present` | Candidate passes screener signal | structural guarantee | Yes |
| `stop_defined` | `candidate.stop is not None` | structural guarantee | Yes |
| `reward_sufficient` | `candidate.rr >= strategy.min_rr` (default 2.0) | candidate.rr, strategy config | No |
| `position_size_reset` | Screener always recalculates fresh | structural guarantee | Yes |
| `timeframe_fits` | Setup type consistent with strategy holding period config | strategy config | Partial |
| `market_context_clean` | No earnings within 5 calendar days + no negative catalyst score from intelligence | intelligence events, earnings calendar | No |

**Gate logic:** if any of `thesis_valid`, `reward_sufficient`, `timeframe_fits`, `market_context_clean` fail → `suppressed = True` → candidate removed from screener results.

Structural guarantees (`new_setup_present`, `stop_defined`, `position_size_reset`) are always marked passed — included in the result for display only.

### Confirmation modal (frontend only)

Triggered when user clicks any candidate with `prior_trades != null`.

**Header:** `{TICKER} — Re-entry Checklist` + `"Exited 14d ago · −1R ✗"` or `"+2.3R ✓"`

**Auto-evaluated section:** 7 rows, each showing rule name + green ✓ or amber ⚠ + backend-provided reason string. Structural guarantees shown as `✓ (automatic)`.

**If last trade was a loss:** amber callout — `"Prior trade was a stop-out — confirm the setup was genuinely invalidated before re-entering."`

**Manual confirmation:** single checkbox — `"I am not re-entering out of emotion or FOMO"`

**Footer buttons:**
- `"Proceed to order setup"` — enabled only when manual checkbox is ticked
- `"Skip — no trade"` — always available, closes modal

**Checklist state:** ephemeral (not persisted). Fresh decision each time.

---

## Section 4 — Analysis Canvas: Trade History Tab

A **"History"** tab is added to `AnalysisCanvasPanel`. The tab is only rendered when `symbol-history` API returns at least one position.

### Summary row (≥ 2 trades)

```
3 trades · win rate 66% · avg outcome +0.8R
```

### Past trades table

Columns: Date · Entry · Exit · Shares · R outcome · Exit reason

- R outcome: green `+2.3R` / red `−1R`
- Row click → expand → shows `thesis`, `lesson`, `notes` fields

### Screener recurrence

```
Seen in screener 8 times · 3-day streak · last seen today
```

Sourced from existing `GET /api/screener/recurrence` (already implemented).

### Open position context (if currently held)

Inline card showing: entry price · current stop · R-now · add-on capacity  
Data from `SameSymbolReentryEvaluator` result on the active candidate, or from `symbol-history` open position.

### Data fetching

- `GET /api/portfolio/symbol-history/{ticker}` — on tab mount, triggered by `selectedTicker` change
- `GET /api/screener/recurrence` — already fetched, filter client-side by ticker
- React Query with 5-min stale time (read-only history, no real-time requirement)

---

## Data Flow

```
ScreenerService.run()
  └─ SameSymbolReentryEvaluator         (open position context)
  └─ PriorTradeAnnotator                (closed position context)
  └─ ReentryGateEvaluator               (rules 1-7, suppresses failing candidates)
  └─ returns enriched ScreenerCandidate[]

Frontend Today/Screener list
  └─ CandidateItem renders ↩ Re-entry badge if prior_trades present
  └─ Click → ReentryChecklistModal
       └─ Shows auto-eval results from reentry_gate.checks
       └─ Manual checkbox → enables "Proceed"
       └─ "Proceed" → existing CandidateOrderModal

AnalysisCanvasPanel
  └─ "History" tab → fetches /api/portfolio/symbol-history/{ticker}
  └─ Renders trade table + recurrence + open position card
```

---

## Testing

**Backend:**
- `ReentryGateEvaluator` unit tests: each rule, suppression logic
- `PriorTradeAnnotator` unit tests: correct context attached per ticker
- `GET /api/portfolio/symbol-history/{ticker}` integration test

**Frontend:**
- `ReentryChecklistModal`: renders auto-eval results, button disabled until checkbox ticked
- `CandidateItem`: renders re-entry badge when `prior_trades` present
- `AnalysisCanvasPanel`: History tab renders on symbol selection with history

---

## Open Questions

None — all resolved in brainstorming session.
