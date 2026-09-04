# Ranking, Data, and Signal Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each PR and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve rank provenance, normalize OHLCV deterministically at ingress, and make signal windows include the current bar correctly.

**Architecture:** Each ranking stage owns a distinct field. One canonical OHLCV normalizer protects all public ingestion paths. Signal calculations slice explicit inclusive windows.

**Tech Stack:** Python 3, pandas, FastAPI/Pydantic contracts, React/TypeScript contracts, pytest, Vitest, Ruff.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- Sorting must have an explicit ticker tie-breaker.
- Normalize data once at public boundaries, not differently inside indicators.
- PR 11 is independent; PR 13 is stacked on PR 12.

---

### Task 1 (PR 11): Preserve rank provenance

**Branch:** `codex/preserve-rank-provenance` from `main`

**Files:**

- Modify: `src/swing_screener/selection/ranking.py`
- Modify: `api/services/screener_service.py`
- Modify: `api/models/screener.py`
- Modify: `tests/test_ranking.py`
- Modify: `tests/test_screener_service.py`
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/features/screener/prioritization.ts`
- Modify: `web-ui/src/features/screener/prioritization.test.ts`
- Modify: `src/swing_screener/selection/README.md`
- Modify: `api/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add provenance and tie tests**

Create candidates where technical rank, confidence rank, and final priority rank
disagree. Assert all three survive serialization. Add equal-score inputs in
different orders and assert identical ticker-ordered output.

- [ ] **Step 2: Give each stage its own field**

Keep `technical_rank` from selection, calculate `confidence_rank` without
overwriting it, and assign `priority_rank` only after final recommendation
ordering. If legacy `rank` remains, document which explicit field it aliases.

- [ ] **Step 3: Update the API boundary and Web UI**

Expose the fields together and update TypeScript transforms/prioritization to
read the intended rank explicitly. Keep this cross-layer change in the same PR.

- [ ] **Step 4: Verify and commit**

Run focused Python tests and Ruff; run `cd web-ui; npm test -- --run` and
`npm run typecheck`. Update selection/API docs and commit with
`Preserve screener rank provenance`.

---

### Task 2 (PR 12): Normalize OHLCV at ingress

**Branch:** `codex/normalize-ohlcv-ingress` from `main`

**Files:**

- Modify: `src/swing_screener/utils/dataframe_helpers.py`
- Modify: `src/swing_screener/data/market_data.py`
- Modify: `src/swing_screener/reporting/report.py`
- Modify: `tests/test_report.py`
- Modify: `tests/test_market_data.py`
- Modify: `src/swing_screener/data/README.md`
- Modify: `src/swing_screener/utils/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add adversarial frame tests**

Cover reverse chronological rows, duplicate dates, duplicate `(field, ticker)`
columns, non-datetime indexes, and missing `Close`. Assert a stable ascending
index, deterministic duplicate-date policy, or an explicit validation error.

- [ ] **Step 2: Implement `normalize_ohlcv()`**

Validate a two-level `(field, ticker)` column index, reject duplicate columns and
missing required fields, normalize the date index, stable-sort ascending, and
keep the last row for duplicate dates. Preserve intentional NaNs for downstream
warm-up behavior.

- [ ] **Step 3: Call it at public boundaries**

Normalize the merged result of chunked provider fetches and any DataFrame passed
directly to the public daily-report builder. Remove redundant local sort fixes
only after tests prove behavior remains identical.

- [ ] **Step 4: Verify and commit**

Run `pytest tests/test_market_data.py tests/test_report.py -q` and Ruff on data,
utils, reporting, and tests. Document the canonical shape and duplicate policy;
commit with `Normalize OHLCV data at ingress`.

---

### Task 3 (PR 13): Correct signal history boundaries

**Branch:** `codex/correct-signal-history-boundaries` from `codex/normalize-ohlcv-ingress`

**Files:**

- Modify: `src/swing_screener/selection/entries.py`
- Modify: `tests/test_entries.py`
- Modify: `src/swing_screener/selection/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add exact-boundary tests**

Use hand-calculated series for the minimum required history, one row short, and
one row extra. Prove breakout lookback excludes only the current comparison bar
and pullback moving averages include exactly the documented number of closes.

- [ ] **Step 2: Name inclusive window helpers**

Replace ambiguous tail slicing with small helpers whose required lengths are
explicit (for example, comparison window plus current bar). Return the existing
insufficient-history result when the full window is unavailable.

- [ ] **Step 3: Verify and commit**

Run `pytest tests/test_entries.py -q` and
`ruff check src/swing_screener/selection/entries.py tests/test_entries.py`.
Document current-bar inclusion and minimum histories, then commit with
`Correct entry signal history boundaries`.
