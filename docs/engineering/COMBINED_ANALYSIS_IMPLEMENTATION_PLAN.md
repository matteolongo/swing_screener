# Combined Analysis Implementation Plan

> Status: handoff-ready engineering plan.
> Last reviewed: 2026-03-19.

## 1. Goal

Implement a symbol-level `decision_summary` that combines:

- screener / technical setup data;
- intelligence / catalyst context;
- fundamentals quality;
- valuation context;
- optional fair-value outputs in a later phase.

This document is written so another coding agent can implement the work in small, atomic PRs with minimal ambiguity.

---

## 2. Scope boundaries

### In scope

- additive backend model(s);
- deterministic decision derivation logic;
- additive API response field(s);
- frontend type transforms;
- one summary card in the workspace analysis area;
- valuation enhancements;
- optional later fair-value and book-value support.

### Out of scope

- live trading automation;
- intraday logic;
- LLM-generated recommendation logic;
- full DCF engine in v1;
- replacing current screener ranking immediately.

---

## 3. Existing code touchpoints

Use these as the starting points for implementation.

### Backend / API

- `api/models/screener.py`
- `api/services/screener_service.py`
- `api/models/intelligence.py`
- `api/services/intelligence_service.py`
- `api/services/workspace_context_service.py`
- `api/models/fundamentals.py`
- `api/services/fundamentals_service.py`
- `src/swing_screener/intelligence/models.py`
- `src/swing_screener/intelligence/scoring.py`
- `src/swing_screener/fundamentals/models.py`
- `src/swing_screener/fundamentals/scoring.py`
- `src/swing_screener/fundamentals/storage.py`

### Frontend

- `web-ui/src/features/screener/types.ts`
- `web-ui/src/features/intelligence/types.ts`
- `web-ui/src/features/fundamentals/types.ts`
- `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx`
- `web-ui/src/components/domain/fundamentals/FundamentalsSnapshotCard.tsx`
- `web-ui/src/i18n/messages.en.ts`

---

## 4. Final target contract

The final concept should look approximately like this:

```json
{
  "decision_summary": {
    "symbol": "AAPL",
    "action": "BUY_ON_PULLBACK",
    "conviction": "medium",
    "technical_label": "strong",
    "fundamentals_label": "strong",
    "valuation_label": "expensive",
    "catalyst_label": "active",
    "why_now": "Trend structure and catalyst support are still constructive.",
    "what_to_do": "Prefer a disciplined pullback or breakout entry and avoid chasing.",
    "main_risk": "Valuation is stretched relative to the current fundamentals.",
    "trade_plan": {
      "entry": 124.5,
      "stop": 118.2,
      "target": 139.0,
      "rr": 2.3
    },
    "valuation_context": {
      "method": "heuristic_multiple",
      "fair_value_low": null,
      "fair_value_base": null,
      "fair_value_high": null,
      "premium_discount_pct": null
    },
    "drivers": {
      "positives": ["Technical setup is ready", "Profitability is healthy"],
      "negatives": ["Valuation looks demanding"],
      "warnings": ["Fundamental coverage is partial"]
    }
  }
}
```

The exact field names can evolve, but the semantic pieces should remain stable.

---

## 5. Decision rules to preserve

### Separation rules

- technicals decide **timing**;
- fundamentals decide **conviction**;
- valuation decides **price attractiveness**;
- catalysts decide **why now**.

### Rule exclusions

- valuation must **not** be merged into fundamental quality in v1;
- fair value must **not** replace entry/stop logic;
- missing data must reduce confidence, not crash the summary.

---

## 6. V1 implementation strategy

The recommended order is:

1. create backend model types;
2. create pure summary builder logic;
3. expose the summary in API responses;
4. wire frontend types;
5. render one top-level summary card;
6. improve valuation context;
7. add fair-value/book-value only in later PRs.

This keeps the first visible version small and deterministic.

---

## 7. Atomic PR plan

## PR 1 — tighten docs and align the decision model

### Purpose

Create the canonical reasoning and implementation docs.

### Files

- `docs/product/COMBINED_ANALYSIS_REASONING.md`
- `docs/engineering/COMBINED_ANALYSIS_IMPLEMENTATION_PLAN.md`
- `docs/overview/INDEX.md`

### Acceptance criteria

- docs explain the product logic clearly;
- implementation plan is concrete enough for follow-up PRs.

### Test/checks

- `git diff --check`

---

## PR 2 — add backend domain models for decision summary

### Purpose

Add the new internal types without changing API or UI behavior.

### Suggested file(s)

- `src/swing_screener/recommendation/models.py`
- or `src/swing_screener/intelligence/decision_summary.py`

### Add these types

#### Enums / literal unions
- `DecisionAction`: `BUY_NOW`, `BUY_ON_PULLBACK`, `WAIT_FOR_BREAKOUT`, `WATCH`, `TACTICAL_ONLY`, `AVOID`, `MANAGE_ONLY`
- `DecisionConviction`: `high`, `medium`, `low`
- `SignalLabel`: `strong`, `neutral`, `weak`
- `ValuationLabel`: `cheap`, `fair`, `expensive`, `unknown`
- `CatalystLabel`: `active`, `neutral`, `weak`

#### Data models
- `DecisionTradePlan`
- `DecisionValuationContext`
- `DecisionDrivers`
- `DecisionSummary`

### Required fields

#### `DecisionTradePlan`
- `entry: float | None`
- `stop: float | None`
- `target: float | None`
- `rr: float | None`

#### `DecisionValuationContext`
- `method: str`
- `fair_value_low: float | None`
- `fair_value_base: float | None`
- `fair_value_high: float | None`
- `premium_discount_pct: float | None`

#### `DecisionDrivers`
- `positives: list[str]`
- `negatives: list[str]`
- `warnings: list[str]`

#### `DecisionSummary`
- `symbol: str`
- `action: str`
- `conviction: str`
- `technical_label: str`
- `fundamentals_label: str`
- `valuation_label: str`
- `catalyst_label: str`
- `why_now: str`
- `what_to_do: str`
- `main_risk: str`
- `trade_plan: DecisionTradePlan`
- `valuation_context: DecisionValuationContext`
- `drivers: DecisionDrivers`

### Tests

- unit tests for defaults / serialization / round-tripping.

### Done when

- models exist;
- tests are deterministic;
- no runtime behavior changes yet.

---

## PR 3 — build pure backend derivation logic

### Purpose

Convert existing screener + intelligence + fundamentals inputs into one `DecisionSummary`.

### Suggested file(s)

- `src/swing_screener/recommendation/decision_summary.py`
- `tests/.../test_decision_summary.py`

### Required function

```python
build_decision_summary(
    candidate,
    opportunity=None,
    fundamentals=None,
) -> DecisionSummary
```

### Derivation rules

#### Technical label

Priority order:

1. use canonical `technical_readiness` if present;
2. otherwise derive from `confidence`, `rr`, `momentum_6m`, `momentum_12m`, `rel_strength`, and signal quality.

Suggested first-pass thresholds:

- `strong`: confidence high, RR valid, and momentum/RS supportive;
- `neutral`: partially constructive;
- `weak`: poor setup or incomplete conditions.

#### Fundamental quality label

Compute from existing pillars only:

- `growth`
- `profitability`
- `balance_sheet`
- `cash_flow`

Do **not** include valuation.

Suggested first pass:

- average available pillar scores;
- map into `strong` / `neutral` / `weak`.

#### Valuation label

Use the existing valuation pillar first:

- `strong` -> `cheap`
- `neutral` -> `fair`
- `weak` -> `expensive`
- missing -> `unknown`

#### Catalyst label

Use `catalyst_strength` and `state`:

- `active` if catalyst score is high or state is `CATALYST_ACTIVE` / `TRENDING`;
- `neutral` if some support exists;
- `weak` otherwise.

#### Conviction

Base it on:

- technical label;
- fundamental quality;
- catalyst support;
- freshness / coverage / data quality penalties.

#### Action mapping

Start with this deterministic truth table:

- strong technical + strong fundamentals + valuation not expensive -> `BUY_NOW`
- strong technical + strong fundamentals + expensive valuation -> `BUY_ON_PULLBACK`
- strong fundamentals + technical not strong -> `WATCH`
- strong technical + weak fundamentals -> `TACTICAL_ONLY`
- weak technical + weak fundamentals -> `AVOID`
- same-symbol manage-only context -> `MANAGE_ONLY`

#### Drivers

Populate short lists from existing signals:

- positives;
- negatives;
- warnings.

Keep lists short:

- max 2 positives;
- max 2 negatives;
- max 2 warnings.

#### Summary sentences

Generate:

- `why_now`
- `what_to_do`
- `main_risk`

Constraints:

- one sentence each;
- plain language;
- no guarantee language;
- gracefully handle missing data.

### Tests

Use table-driven tests for at least these scenarios:

1. strong technical + strong fundamentals + fair valuation -> `BUY_NOW`
2. strong technical + strong fundamentals + expensive valuation -> `BUY_ON_PULLBACK`
3. strong fundamentals + weak technical -> `WATCH`
4. strong technical + weak fundamentals -> `TACTICAL_ONLY`
5. weak everything -> `AVOID`
6. stale / partial fundamentals lowers conviction
7. same-symbol manage-only -> `MANAGE_ONLY`

### Done when

- the builder is pure and deterministic;
- unit tests cover the truth table;
- no endpoint wiring yet.

---

## PR 4 — expose `decision_summary` in API responses

### Purpose

Add the new summary to API responses in an additive, backward-compatible way.

### Primary files

- `api/models/screener.py`
- `api/services/screener_service.py`
- possibly `api/models/chat.py` if workspace snapshot should carry the summary later

### Work items

- add pydantic API models mirroring the new summary types;
- add optional `decision_summary` field to `ScreenerCandidate`;
- populate the field in `api/services/screener_service.py`;
- keep the field optional to avoid breaking existing clients.

### Tests

- API model validation tests;
- service/endpoint tests verifying `decision_summary` appears when enough data exists.

### Done when

- API response shape includes the field;
- old clients still work.

---

## PR 5 — wire frontend TypeScript types and transforms

### Purpose

Allow the Web UI to consume `decision_summary` safely.

### Primary files

- `web-ui/src/features/screener/types.ts`
- optionally `web-ui/src/features/chat/types.ts` if workspace snapshot needs it

### Work items

- add TS interfaces for the summary object;
- map snake_case API fields to camelCase UI fields;
- keep `decisionSummary` optional;
- update tests for transforms.

### Tests

- `web-ui/src/features/screener/types.test.ts`
- any transform regression tests needed.

### Done when

- TS types compile;
- `transformScreenerResponse` exposes the field cleanly.

---

## PR 6 — render the Decision Summary card in workspace analysis

### Purpose

Add the first visible UI for the feature.

### Primary files

- `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx`
- new component, e.g. `web-ui/src/components/domain/workspace/DecisionSummaryCard.tsx`
- `web-ui/src/i18n/messages.en.ts`
- tests for the new component and panel integration

### Recommended placement

Render it in the workspace analysis **overview tab**, above the chart or above the key metrics block.

Reason:

- this is where users first inspect a selected symbol;
- it avoids hiding the new feature behind the fundamentals tab;
- it keeps technical, context, and business summary in one place.

### Required UI sections

#### Header
- ticker
- action badge
- conviction badge

#### Signal badges
- technical
- fundamentals
- valuation
- catalyst

#### Trade plan row
- entry
- stop
- target
- RR

#### Summary copy
- why this stands out
- what to do now
- main risk

#### Warning area
- stale / partial / low-quality data warnings if present

### UX rules

- hide empty sections cleanly;
- do not require fair value in v1;
- keep card compact;
- no hardcoded copy outside i18n.

### Tests

- component render with full data;
- component render with partial data;
- integration test in `AnalysisCanvasPanel.test.tsx`.

### Screenshot

If browser screenshot tooling is available when the UI PR is implemented, capture one.

### Done when

- card renders in workspace overview;
- card degrades gracefully when fields are missing.

---

## PR 7 — improve valuation context without adding new provider fields

### Purpose

Make valuation output more explicit using current fundamentals only.

### Primary files

- decision summary builder module
- associated unit tests

### Work items

- set `valuation_context.method = "heuristic_multiple"`;
- derive explanation text from current valuation pillar and raw PE / price-to-sales fields when present;
- keep fair-value numeric outputs null for now.

### Done when

- valuation section is more explicit;
- still no new provider data required.

---

## PR 8 — extend fundamentals model for book-value metrics

### Purpose

Add the raw fields needed for price-to-book and book-to-price.

### Primary files

- `src/swing_screener/fundamentals/models.py`
- provider extraction files under fundamentals providers
- `src/swing_screener/fundamentals/scoring.py`
- `src/swing_screener/fundamentals/storage.py`
- `api/models/fundamentals.py`
- `web-ui/src/features/fundamentals/types.ts`

### Add fields

- `shares_outstanding`
- `total_equity`
- `book_value_per_share`
- `price_to_book`
- `book_to_price`
- optional `tangible_book_value_per_share`

### Requirements

- deserialization must remain backward compatible;
- storage of old snapshots must still load;
- missing values are acceptable.

### Tests

- provider parsing tests;
- snapshot serialization tests;
- backward compatibility tests.

### Done when

- raw book-value metrics are available end-to-end.

---

## PR 9 — add fair-value v1

### Purpose

Add a simple, explainable fair-value estimate.

### Recommended methods for v1

- `earnings_multiple`
- `sales_multiple`
- `book_multiple`
- `not_available`

### Requirements

- deterministic only;
- prefer returning a range if possible (`low`, `base`, `high`);
- if confidence is too low, return `not_available`.

### Output

Populate:

- `fair_value_low`
- `fair_value_base`
- `fair_value_high`
- `premium_discount_pct`
- `method`

### Tests

- table-driven tests per method;
- tests for missing-data fallback.

### Done when

- fair-value context is available for supported symbols;
- unsupported cases degrade cleanly.

---

## PR 10 — show fair value in the UI

### Purpose

Extend the summary card to show fair-value context when available.

### UI rules

- if fair value is unavailable, show valuation label only;
- if fair value exists, show it as secondary context;
- never present fair value as the trade trigger by itself.

### Tests

- component tests with and without fair value.

### Done when

- users can distinguish entry price from fair-value context instantly.

---

## PR 11 — sector-aware valuation weighting (optional)

### Purpose

Improve valuation relevance by sector.

### Examples

- financials: emphasize book-based metrics;
- software/high-growth: de-emphasize book-based metrics;
- mature cash-generative names: increase weight of cash-flow-based metrics.

### Done when

- valuation labels become more context-aware without hidden heuristics.

---

## PR 12 — use decision summary for ranking / prioritization (optional)

### Purpose

Optionally use action state + conviction to improve watchlist or screener prioritization.

### Guardrails

- do not silently replace raw screener score;
- keep ranking logic documented and explainable.

---

## 8. Suggested exact implementation order for the next coding agent

If the next agent is asked to implement code immediately, the safest sequence is:

1. PR 2 — backend models
2. PR 3 — pure summary builder + tests
3. PR 4 — API exposure
4. PR 5 — frontend transforms
5. PR 6 — summary card UI

This gives a usable v1 without waiting for fair value.

---

## 9. Definition of done for v1

V1 is done when:

1. a screener candidate can carry a `decision_summary` payload;
2. the payload is derived deterministically from current technical + intelligence + fundamentals data;
3. the workspace overview shows the summary card for the selected symbol;
4. the card explains action, why, and risk;
5. symbols with partial data still render safely;
6. tests cover the decision truth table and UI missing-data states.

---

## 10. Notes to the implementing agent

- Keep all new user-facing copy in i18n.
- Keep contracts additive.
- Prefer pure functions over hidden service state.
- Document any schema/storage change in the nearest README if you touch persisted fundamentals snapshots.
- Do not block v1 on fair-value math.
- For v1, clarity is more important than scoring sophistication.
