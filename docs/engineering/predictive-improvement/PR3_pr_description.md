# PR 3 — Server-Owned Explanation Contract

**Branch:** `feat/explanation-contract` → `feat/unified-snapshot`

---

## Summary

- Adds a structured `ExplanationContract` model to `DecisionSummary` with deterministic per-section lists: `why_it_qualified`, `why_now`, `main_risks`, `what_invalidates_it`, `next_best_action`, `confidence_notes`
- Backend populates all sections deterministically from existing builder logic — same input always produces identical output
- Frontend renders backend sections directly as bullet lists; falls back to old flat-string layout when `explanation` is null (backward-compatible)

## Problem solved

The old `DecisionSummary` exposed flat string fields (`why_now`, `main_risk`) and raw `drivers` lists. Each UI component assembled display text independently, making it possible for the same backend state to render differently across code paths. Adding a new caveat (e.g. "data is stale") required changes in both backend and frontend.

## Changes

**Backend**
- `models.py` — new `ExplanationContract` Pydantic model; `explanation: ExplanationContract | None` field on `DecisionSummary`
- `decision_summary.py` — new `_build_explanation_contract()` builder; called at end of `build_decision_summary()`; `confidence_notes` sourced from `drivers.warnings` (freshness, coverage, data quality flags)
- `__init__.py` — exports `ExplanationContract`

**Frontend**
- `types.ts` — `ExplanationContract` / `ExplanationContractAPI` interfaces; `explanation?` mapped in `transformDecisionSummary`
- `DecisionSummaryCard.tsx` — renders structured sections when `explanation` is present; falls back to old layout when null; `confidence_notes` replaces `drivers.warnings` as caveat source
- `messages.en.ts` — adds `whyItQualified` and `whatInvalidatesIt` i18n keys

## Tests

4 new tests in `tests/test_decision_summary.py`:
- `test_explanation_contract_is_populated` — contract is always present with at least one qualifier and a non-empty action
- `test_explanation_contract_is_deterministic` — same input produces identical contract twice
- `test_stale_fundamentals_produce_confidence_note` — stale snapshot surfaces a note in `confidence_notes`
- `test_partial_coverage_produces_confidence_note` — partial coverage surfaces at least one note

All 18 tests pass. No existing tests broken.

## Backward compatibility

`explanation` is additive — all existing `DecisionSummary` fields are unchanged. Cached responses without `explanation` render the old layout automatically.

## Part of

Predictive & Explanation Improvement Plan — PR3 of 8
Base branch: `feat/unified-snapshot` (PR2)
