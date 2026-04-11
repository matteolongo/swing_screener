# PR 3 — Server-Owned Explanation Contract

> Branch: `feat/explanation-contract`
> Base: `feature/ux-revamp`
> Depends on: PR2
> Blocks: PR4

---

## Problem

The current `DecisionSummary` exposes top-level labels (`technical_label`, `fundamentals_label`, etc.) and flat driver lists. The frontend assembles these into display text locally, and in some paths `decisionSummary.ts` regenerates the full summary.

Consequences:
- The same backend state can render differently depending on which frontend code path executed.
- Adding a new explanation caveat (e.g. "data is stale") requires changes in both backend and frontend.
- There is no guaranteed structure for "why it qualified", "why now", "main risks" — these are assembled differently in different UI components.

---

## Changes

### 1. New `ExplanationContract` model

**`src/swing_screener/recommendation/models.py`** (or alongside `DecisionSummary`):

```python
@dataclass
class ExplanationContract:
    summary_line: str                   # one sentence, e.g. "Strong breakout with catalyst support."
    why_it_qualified: list[str]         # 2–4 bullets from technical + fundamentals
    why_now: list[str]                  # 1–2 bullets from catalyst / timing
    main_risks: list[str]               # 2–3 bullets
    what_invalidates_it: list[str]      # 1–2 bullets (stop logic, thesis break)
    next_best_action: str               # one sentence matching decision action
    confidence_notes: list[str]         # freshness / coverage / evidence caveats
```

Attach to `DecisionSummary`:
```python
@dataclass
class DecisionSummary:
    ...existing fields...
    explanation: ExplanationContract | None = None
```

### 2. `src/swing_screener/recommendation/decision_summary.py` — populate `ExplanationContract`

Extract from existing builder logic:
- `why_it_qualified` ← top items from `drivers.positives` filtered to technical + fundamentals
- `why_now` ← `decision_summary.why_now` (already exists as a string — split or restructure to list)
- `main_risks` ← top items from `drivers.negatives` + `main_risk` field
- `what_invalidates_it` ← stop level text + `drivers.warnings`
- `next_best_action` ← `_ACTION_WHAT_TO_DO[action]` (already exists)
- `confidence_notes` ← built from:
  - fundamentals freshness flag
  - intelligence evidence quality
  - partial data coverage flags
  - snapshot consistency warnings (from PR2)

**Rule**: `ExplanationContract` must be deterministic — same `DecisionSummary` input always produces identical output.

### 3. Frontend — render, do not compute

**`web-ui/src/components/domain/workspace/DecisionSummaryCard.tsx`** (or equivalent)

- Map `explanation.why_it_qualified` → bullet list
- Map `explanation.why_now` → bullet list
- Map `explanation.main_risks` → bullet list
- Map `explanation.confidence_notes` → small-text caveat block (visually distinct)
- Remove any local string-assembly logic for these sections

**`web-ui/src/features/screener/decisionSummary.ts`**

- If `rebuildDecisionSummaryWithFundamentals` was not removed in PR2, remove it now.
- Delete any frontend function that derives `summary_line`, `why_now`, `main_risks`, or `what_invalidates_it` from raw candidate fields.

### 4. Backward compatibility

Keep all existing `DecisionSummary` fields untouched. `explanation` is additive.
Frontend can fall back to raw labels if `explanation` is `null` (for cached responses not yet regenerated).

---

## Tests

### `tests/test_decision_summary.py`

**Test 1 — ExplanationContract is populated**
```python
def test_explanation_contract_is_populated():
    summary = build_decision_summary(candidate, opportunity=..., fundamentals=...)
    assert summary.explanation is not None
    assert len(summary.explanation.why_it_qualified) >= 1
    assert summary.explanation.next_best_action != ""
```

**Test 2 — deterministic output**
```python
def test_explanation_contract_is_deterministic():
    s1 = build_decision_summary(candidate, ...)
    s2 = build_decision_summary(candidate, ...)
    assert s1.explanation == s2.explanation
```

**Test 3 — stale fundamentals produce confidence_notes**
```python
def test_stale_fundamentals_produce_confidence_note():
    # fundamentals with old report_date
    summary = build_decision_summary(candidate, fundamentals=stale_snapshot, ...)
    assert any("stale" in note.lower() or "old" in note.lower()
               for note in summary.explanation.confidence_notes)
```

**Test 4 — partial coverage produces confidence_notes**
```python
def test_partial_coverage_produces_confidence_note():
    # fundamentals with missing pillars
    summary = build_decision_summary(candidate, fundamentals=partial_snapshot, ...)
    assert len(summary.explanation.confidence_notes) >= 1
```

---

## Acceptance criteria

- [ ] `DecisionSummary.explanation` is always populated when `build_decision_summary` runs.
- [ ] Same input state always produces identical `ExplanationContract`.
- [ ] `confidence_notes` is non-empty when data is stale, partial, or has low evidence quality.
- [ ] Frontend displays backend explanation directly; no local string assembly for structured sections.
- [ ] All four new tests pass.
- [ ] No existing tests broken.
