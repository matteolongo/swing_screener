# Order and Daily Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each PR and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fail closed on uncertain order state, report position-evaluation failures honestly, honor stateless request data, and separate computation from persistence.

**Architecture:** Daily-review evaluation receives an explicit state snapshot. Errors and blocked decisions are typed outputs. Read/compute paths do not persist; a dedicated command endpoint owns snapshot writes.

**Tech Stack:** Python 3, FastAPI, Pydantic, pytest, Ruff.

**Spec:** `docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`

## Global Constraints

- Unknown order state cannot produce a new-entry action.
- Client-supplied stateless state is authoritative for the entire calculation.
- PRs 7–10 occupy consecutive positions in the global linear stack.

---

### Task 1 (PR 7): Fail closed for pending or unavailable orders

**Branch:** `codex/fail-closed-pending-orders` from `codex/stabilize-report-plan-schema`

**Files:**

- Modify: `api/services/screener_service.py`
- Modify: `src/swing_screener/risk/recommendations/engine.py`
- Modify: `tests/test_screener_service.py`
- Modify: `tests/test_risk_engine.py`
- Modify: `api/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add duplicate-order regressions**

Test a symbol with a pending buy but no open position, and a repository read
failure. Both must produce a non-actionable review result with a stable reason;
neither may issue a new-entry recommendation or approval token.

- [ ] **Step 2: Resolve order state before recommendation**

Build a same-symbol pending-order index before position ownership checks. Pass
an explicit order-state result into recommendation evaluation and block new
entry when the symbol is pending or state is unavailable.

- [ ] **Step 3: Publish typed reasons**

Use distinct machine-readable reasons such as `pending_order_exists` and
`order_state_unavailable`. Preserve the existing manual-management path for
held positions.

- [ ] **Step 4: Verify and commit**

Run `pytest tests/test_screener_service.py tests/test_risk_engine.py -q` and Ruff
on changed files. Update API behavior docs and commit with
`Block entries when order state is uncertain`.

---

### Task 2 (PR 8): Separate position evaluation errors

**Branch:** `codex/separate-review-evaluation-errors` from `codex/fail-closed-pending-orders`

**Files:**

- Modify: `api/models/daily_review.py`
- Modify: `api/services/daily_review_service.py`
- Modify: `tests/api/test_daily_review_service.py`
- Modify: `tests/api/test_daily_review_compute_endpoint.py`
- Modify: `api/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Reproduce partial position failure**

Make one position evaluator raise while another succeeds. Assert the successful
position remains, the failed symbol appears exactly once in `evaluation_errors`,
and the summary counts success, skip, and error separately.

- [ ] **Step 2: Add a typed error model**

Create `DailyReviewPositionEvaluationError` with symbol, stable error code, and
sanitized message. Add `evaluation_errors` and `evaluation_error_count` to the
review response without overloading `skipped_positions`.

- [ ] **Step 3: Narrow exception handling**

Catch per-position domain/data errors at the loop boundary, append the typed
error, and continue. Let request-wide invariant failures fail the whole request
instead of being mislabeled as a position skip.

- [ ] **Step 4: Verify and commit**

Run the two daily-review test files and Ruff on their source. Document the
response addition and commit with `Report daily review evaluation errors`.

---

### Task 3 (PR 9): Use request state throughout stateless review

**Branch:** `codex/use-stateless-review-orders` from `codex/separate-review-evaluation-errors`

**Files:**

- Modify: `api/models/daily_review.py`
- Modify: `api/services/daily_review_service.py`
- Modify: `api/services/screener_service.py`
- Modify: `tests/api/test_daily_review_compute_endpoint.py`
- Modify: `tests/test_screener_service.py`
- Modify: `api/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add server/client divergence tests**

Supply client orders and positions that deliberately differ from repository
state. Assert pending-order review, same-symbol filtering, and position ownership
all use the request snapshot. Assert the repositories are not read.

- [ ] **Step 2: Introduce one immutable state snapshot**

Add an internal `PortfolioStateSnapshot(positions, orders)` and a shared pure
helper for pending-order review. Build it from validated request models on the
stateless endpoint and from repositories on the stateful endpoint.

- [ ] **Step 3: Thread the snapshot through screening**

Add an optional internal snapshot argument to `ScreenerService.run_screener()`
and its same-symbol/order filters. When present, every ownership and pending
check uses it; never fall back to server state for a missing symbol.

- [ ] **Step 4: Verify and commit**

Run `pytest tests/api/test_daily_review_compute_endpoint.py tests/test_screener_service.py -q`
and Ruff. Document stateless authority and commit with
`Honor request state in stateless daily review`.

---

### Task 4 (PR 10): Make review persistence explicit

**Branch:** `codex/make-review-persistence-explicit` from `codex/use-stateless-review-orders`

**Files:**

- Modify: `api/routers/daily_review.py`
- Modify: `api/services/daily_review_service.py`
- Modify: `api/services/daily_review/writer.py`
- Modify: `api/models/daily_review.py`
- Modify: `api/services/screener_service.py`
- Modify: `src/swing_screener/selection/eval_cache.py`
- Modify: `tests/api/test_daily_review_compute_endpoint.py`
- Modify: `tests/api/test_daily_review_service.py`
- Modify: `api/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Instrument forbidden writes**

Patch snapshot writers, review-queue writers, and evaluation-cache writes to
raise. Assert GET and stateless compute routes still succeed. Add a separate
test proving the explicit save route performs one atomic snapshot write.

- [ ] **Step 2: Split compute from command**

Make `generate_daily_review(..., persist: bool = False)` pure with respect to
business-state files. Add `POST /daily-review/snapshots` with a validated
`DailyReviewSnapshotRequest`; this command alone invokes the writer.

- [ ] **Step 3: Add a no-write screener policy**

Introduce internal `ScreenerRunPolicy` flags for cache/review-artifact writes.
Daily-review compute passes a no-write policy through candidate screening and
evaluation-cache calls; the normal screener endpoint retains its current policy.

- [ ] **Step 4: Remove constructor writes**

Do not create directories in service constructors. Create the exact parent
directory immediately before an explicit atomic write.

- [ ] **Step 5: Verify and commit**

Run all daily-review, screener-service, and eval-cache tests plus Ruff. Update
API docs with query/command semantics and commit with
`Separate daily review computation from persistence`.
