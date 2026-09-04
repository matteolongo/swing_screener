# Reporting Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each PR and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make empty/blocked planning output schema-stable and define sector concentration mathematically.

**Architecture:** Trade-plan construction emits a fixed typed tabular contract for every outcome. Concentration uses one documented denominator, threshold boundary, and unknown-sector policy.

**Tech Stack:** Python 3, pandas, pytest, Ruff.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- Empty results are valid data, not exceptions or shape changes.
- Blocked plans preserve a machine-readable reason.
- Each task below is an independent PR from `main`.

---

### Task 1 (PR 6): Stabilize the trade-plan schema

**Branch:** `codex/stabilize-report-plan-schema` from `main`

**Files:**

- Modify: `src/swing_screener/reporting/report.py`
- Modify: `tests/test_report.py`
- Modify: `src/swing_screener/reporting/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add empty and blocked contract tests**

Assert no candidates, all candidates filtered, and all candidates blocked return
the same ordered columns and stable dtypes as a populated result. Assert each
blocked input retains `plan_status` and `block_reason` in a companion result or
the canonical plan table rather than disappearing silently.

- [ ] **Step 2: Define the schema once**

Add module-level ordered column/dtype definitions and an `_empty_trade_plans()`
factory. Reindex every return path to that schema; do not construct ad hoc empty
`DataFrame()` values.

- [ ] **Step 3: Preserve per-candidate planning outcomes**

Introduce a small typed outcome such as
`PositionPlanOutcome(plan, status, block_reason)`. Keep the existing public
`position_plan()` wrapper if compatibility requires it, but make batch planning
use the outcome API so rejection causes survive.

- [ ] **Step 4: Verify downstream output**

Add tests for CSV generation and `today_actions` against empty and blocked
frames. Run `pytest tests/test_report.py -q` and
`ruff check src/swing_screener/reporting tests/test_report.py`.
Document the schema and commit with `Stabilize trade-plan output schema`.

---

### Task 2 (PR 16): Define sector concentration semantics

**Branch:** `codex/define-sector-concentration` from `main`

**Files:**

- Modify: `src/swing_screener/reporting/concentration.py`
- Modify: `tests/test_report.py`
- Modify: `src/swing_screener/reporting/README.md`
- Modify: `config/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Specify boundary cases**

Add failing tests for duplicate tickers, unknown/blank sectors, exactly-at-limit
ratios, just-below-limit ratios, and candidate counts around the minimum. Use
fixtures where the denominator choice changes the answer.

- [ ] **Step 2: Implement the approved formula**

Deduplicate by ticker. Use all unique candidates as the denominator; unknown
sector candidates count in that denominator but do not form a named sector.
Warn when `sector_count / total_unique_candidates >= max_sector_fraction` and
`total_unique_candidates >= min_candidates`.

- [ ] **Step 3: Validate configuration**

Reject fractions outside `[0, 1]` and `min_candidates < 1` at config load time.
Sort warnings deterministically by descending concentration then sector name.

- [ ] **Step 4: Document and verify**

Run `pytest tests/test_report.py -q` and Ruff on reporting/config code. Document
the exact numerator, denominator, unknown policy, and inclusive boundary, then
commit with `Define sector concentration thresholds`.
