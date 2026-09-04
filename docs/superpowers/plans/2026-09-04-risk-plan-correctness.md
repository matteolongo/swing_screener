# Risk and Plan Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each PR and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve structural strategy targets and make position sizing reject invalid or unexecutable price geometry.

**Architecture:** Keep strategy-authored targets immutable through the risk workflow. Normalize prices once at the execution boundary, then use those normalized values for both share count and reported risk.

**Tech Stack:** Python 3, pandas, pytest, Ruff.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- Keep `1R = entry_price - stop_price` as the only sizing model.
- Do not add broker execution or intraday behavior.
- Each task below is one independently reviewable PR.

---

### Task 1 (PR 1): Preserve structural targets through recommendations

**Branch:** `codex/preserve-structural-targets` from `main`

**Files:**

- Modify: `src/swing_screener/risk/engine.py`
- Modify: `tests/test_risk_engine.py`
- Modify: `src/swing_screener/risk/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a failing regression test**

Create a complete thesis input where the structural target differs from a
derived reward multiple. Assert the recommendation receives the original
`target`, while derived reward/risk fields remain independently calculated.

Run: `pytest tests/test_risk_engine.py -q`
Expected: FAIL because `evaluate_candidate()` currently overwrites `target`.

- [ ] **Step 2: Remove the target reassignment**

Keep the strategy-provided `target` bound to its original value and pass it to
the recommendation builder. Name any derived target-like value for what it is
(for example, `reward_target`) and never assign it back to `target`.

- [ ] **Step 3: Cover absent and invalid target cases**

Add tests showing that an absent structural target follows the existing
fallback contract and that rejection behavior is unchanged for invalid thesis
geometry.

- [ ] **Step 4: Document and verify**

Document target provenance in the risk README and add an `Unreleased` fix note.
Run `pytest tests/test_risk_engine.py -q` and `ruff check src/swing_screener/risk tests/test_risk_engine.py`.

- [ ] **Step 5: Commit**

Commit with: `Preserve structural recommendation targets`

---

### Task 2 (PR 14): Harden sizing inputs and execution precision

**Branch:** `codex/harden-position-sizing-inputs` from `main`

**Files:**

- Modify: `src/swing_screener/risk/position_sizing.py`
- Modify: `tests/test_position_sizing.py`
- Modify: `src/swing_screener/risk/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Specify invalid inputs with failing tests**

Parametrize `NaN`, positive/negative infinity, non-positive equity, non-positive
entry, and non-positive risk fractions. Assert `ValueError` with the field name.
Add a rounding-boundary case where raw entry and stop are distinct but both
round to the same executable cent; assert the trade is rejected.

- [ ] **Step 2: Add one finite-positive validator**

Introduce `_finite_positive(name: str, value: float) -> float`, using
`math.isfinite`, and call it for every scalar that participates in sizing.

- [ ] **Step 3: Normalize execution prices before sizing**

Round entry and stop once to the configured execution precision, validate
`stop_exec < entry_exec`, and calculate per-share risk, shares, position value,
and reported risk from those same normalized values. Do not round only for
display after shares have been calculated.

- [ ] **Step 4: Document and verify**

Document finite-input and precision semantics. Run
`pytest tests/test_position_sizing.py -q` and
`ruff check src/swing_screener/risk tests/test_position_sizing.py`.

- [ ] **Step 5: Commit**

Commit with: `Validate executable position sizing inputs`
