# Fail-Closed Order Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure `SKIP`, contradictory workflow guidance, and incomplete trade plans cannot generate approval tokens or actionable order tickets.

**Architecture:** The backend removes the `ready + SKIP` contradiction before serialization and refuses approval claims for skipped entries. A pure frontend eligibility function becomes the sole authority used by ActionPanel and OrderReviewExperience, validating canonical workflow, the pending-pullback exception, freshness, approval, same-symbol state, and complete finite plan values without synthetic defaults.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, React 18, TypeScript, Vitest, React Testing Library, React Hook Form, repository i18n.

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-reporting-remediation-design.md`

## Global Constraints

- Preserve deterministic end-of-day screening and manual execution.
- `workflow_status` and `next_step` remain backend-authoritative.
- `decision_summary.action` is display-only.
- `SKIP` is never actionable and never receives an approval token.
- Preserve the pending `waiting_trigger` / `wait_pullback` exception only for `BUY_LIMIT` with an approval token.
- Missing, zero, non-finite, inverted, or incomplete trade-plan values block order review.
- Do not fabricate entry, stop, target, shares, reward:risk, or currency defaults.
- API mode requires an approval token; local persistence still requires the same workflow/data/plan checks.
- All user-facing copy uses existing or new i18n keys.
- Backend and frontend contract changes ship in this same PR.

---

### Task 1: Normalize skipped execution guidance in the backend

**Files:**
- Modify: `api/services/screener_service.py:182-262`
- Modify: `api/services/screener_service.py:1108-1115`
- Test: `tests/api/test_candidate_approval.py`
- Test: `tests/test_screener_service.py`
- Modify: `api/README.md`

**Interfaces:**
- Consumes: `candidate.suggested_order_type`, original screener `signal`, recommendation gates/workflow.
- Produces: no approval token for `SKIP`; skipped execution guidance enters recommendation evaluation as no executable signal and cannot serialize as `ready/review_order`.

- [ ] **Step 1: Write a failing approval-token regression test**

Add a candidate fixture with PASS setup/trigger/plan gates, current data, valid earnings/currency/risk fields, and `suggested_order_type="SKIP"`:

```python
def test_skip_candidate_never_receives_approval_claims():
    candidate = build_actionable_candidate(
        suggested_order_type="SKIP",
        workflow_status="ready",
        next_step_code="review_order",
    )

    claims = _approval_claims_for_candidate(candidate, "strategy-1", "revision-1")

    assert claims is None
```

- [ ] **Step 2: Run the approval test and verify RED**

Run:

```bash
pytest tests/api/test_candidate_approval.py -k skip -q
```

Expected: the new assertion fails because `_approval_claims_for_candidate()` currently returns claims whose order type is `SKIP`.

- [ ] **Step 3: Add the explicit backend guard**

At the start of `_approval_claims_for_candidate()` after reading the recommendation, normalize the type and return safely:

```python
    suggested_order_type = str(
        getattr(candidate, "suggested_order_type", "") or ""
    ).upper()
    if suggested_order_type == "SKIP":
        return None
```

Reuse `suggested_order_type` when constructing `ApprovalTokenClaims.order_type` so the normalized value has one source.

- [ ] **Step 4: Write a failing screener-output regression test**

Exercise a breakout whose close is already above the breakout level with `allow_second_chance_breakout=False` and assert:

```python
candidate = result.candidates[0]
assert candidate.suggested_order_type == "SKIP"
assert candidate.approval_token is None
assert candidate.recommendation.workflow_status != "ready"
assert candidate.recommendation.next_step.code != "review_order"
```

- [ ] **Step 5: Run the screener regression and verify RED**

Run:

```bash
pytest tests/test_screener_service.py -k skip -q
```

Expected: guidance is `SKIP`, but workflow remains `ready` because the original breakout signal is reused.

- [ ] **Step 6: Stop promoting `SKIP` through the original signal**

Replace the ternary at the recommendation evaluation boundary with explicit precedence:

```python
            if suggested_order_type == "BUY_LIMIT":
                evaluation_signal = "BUY_ON_PULLBACK"
            elif suggested_order_type == "BUY_STOP":
                evaluation_signal = "WAIT_FOR_BREAKOUT"
            elif suggested_order_type == "SKIP":
                evaluation_signal = None
            else:
                evaluation_signal = (
                    str(signal) if not is_na_scalar(signal) else None
                )
```

Do not change the displayed `suggested_order_type` or execution note; only the recommendation workflow becomes non-actionable.

- [ ] **Step 7: Run focused backend tests and verify GREEN**

Run:

```bash
pytest tests/api/test_candidate_approval.py tests/test_screener_service.py -k "skip or approval" -q
```

Expected: skipped candidates retain the skip explanation, receive no token, and are not ready.

- [ ] **Step 8: Document and commit the backend contract**

In `api/README.md`, state that `SKIP` guidance cannot be `ready` and never receives an entry approval token. Then run:

```bash
git add api/services/screener_service.py tests/api/test_candidate_approval.py tests/test_screener_service.py api/README.md
git commit -m "Prevent approval of skipped entries"
```

---

### Task 2: Add one pure frontend eligibility authority

**Files:**
- Create: `web-ui/src/features/orders/orderEligibility.ts`
- Create: `web-ui/src/features/orders/orderEligibility.test.ts`
- Read for types: `web-ui/src/features/screener/types.ts`
- Read for workflow exception: `web-ui/src/components/domain/recommendation/workflowPresentation.ts`

**Interfaces:**
- Consumes: `OrderEligibilityInput` shown below.
- Produces: `resolveOrderEligibility(input: OrderEligibilityInput): OrderEligibility`.

- [ ] **Step 1: Write table-driven failing tests**

Create `orderEligibility.test.ts` with this base input and cases:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveOrderEligibility, type OrderEligibilityInput } from './orderEligibility';

const ready: OrderEligibilityInput = {
  workflowStatus: 'ready',
  nextStepCode: 'review_order',
  suggestedOrderType: 'BUY_LIMIT',
  approvalToken: 'signed-token',
  dataStatus: 'current',
  dataAsOf: '2026-09-04',
  persistenceMode: 'api',
  hasOpenPosition: false,
  sameSymbolMode: null,
  plan: { entry: 100, stop: 95, target: 110, shares: 20, rewardRisk: 2, currency: 'USD' },
};

describe('resolveOrderEligibility', () => {
  it('allows a complete canonical ready candidate', () => {
    expect(resolveOrderEligibility(ready)).toEqual({ allowed: true, mode: 'ready' });
  });

  it.each([
    ['SKIP', 'skip_guidance'],
    ['UNKNOWN', 'workflow_not_actionable'],
  ] as const)('blocks suggested type %s', (suggestedOrderType, reason) => {
    expect(resolveOrderEligibility({ ...ready, suggestedOrderType })).toEqual({ allowed: false, reason });
  });

  it.each([
    [{ entry: undefined }, 'plan_incomplete'],
    [{ stop: 100 }, 'plan_invalid'],
    [{ target: 99 }, 'plan_invalid'],
    [{ shares: 0 }, 'plan_invalid'],
    [{ rewardRisk: Number.NaN }, 'plan_invalid'],
    [{ currency: 'UNKNOWN' }, 'plan_invalid'],
  ] as const)('blocks invalid plan patch %o', (patch, reason) => {
    const plan = { ...ready.plan, ...patch };
    expect(resolveOrderEligibility({ ...ready, plan })).toEqual({ allowed: false, reason });
  });

  it('allows only the documented pending pullback exception', () => {
    expect(resolveOrderEligibility({
      ...ready,
      workflowStatus: 'waiting_trigger',
      nextStepCode: 'wait_pullback',
      suggestedOrderType: 'BUY_LIMIT',
    })).toEqual({ allowed: true, mode: 'pending_pullback' });
  });
});
```

Add cases for missing API approval, non-current data, missing `dataAsOf`, held `NEW_ENTRY`, and allowed held `ADD_ON`/`SCALE_BACK`.

- [ ] **Step 2: Run the unit test and verify RED**

Run:

```bash
cd web-ui && npx vitest run src/features/orders/orderEligibility.test.ts
```

Expected: import failure because the module does not exist.

- [ ] **Step 3: Implement the discriminated eligibility function**

Create the module with these public types:

```typescript
import type { NextStepCode, WorkflowStatus } from '@/types/recommendation';
import type { SameSymbolMode } from '@/features/screener/types';

export interface OrderPlanInput {
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  shares?: number | null;
  rewardRisk?: number | null;
  currency?: string | null;
}

export interface OrderEligibilityInput {
  workflowStatus?: WorkflowStatus | null;
  nextStepCode?: NextStepCode | null;
  suggestedOrderType?: string | null;
  approvalToken?: string | null;
  dataStatus?: string | null;
  dataAsOf?: string | null;
  persistenceMode: 'api' | 'local';
  hasOpenPosition: boolean;
  sameSymbolMode?: SameSymbolMode | null;
  plan: OrderPlanInput;
}

export type OrderEligibility =
  | { allowed: true; mode: 'ready' | 'pending_pullback' }
  | { allowed: false; reason: 'skip_guidance' | 'workflow_not_actionable' | 'approval_missing' | 'data_not_current' | 'plan_incomplete' | 'plan_invalid' | 'held_symbol_not_add_on' };
```

Implement finite-number validation with `Number.isFinite`, require positive entry/target/shares/R:R, `stop > 0 && stop < entry`, `target > entry`, and currency matching `/^[A-Z]{3}$/` excluding `UNKNOWN`. Check `SKIP` before workflow. API mode requires the token. An open position is allowed only for `ADD_ON` or `SCALE_BACK`.

- [ ] **Step 4: Run the eligibility tests and verify GREEN**

Run:

```bash
cd web-ui && npx vitest run src/features/orders/orderEligibility.test.ts
```

Expected: all table-driven cases pass.

- [ ] **Step 5: Commit the pure authority**

```bash
git add web-ui/src/features/orders/orderEligibility.ts web-ui/src/features/orders/orderEligibility.test.ts
git commit -m "Add fail-closed order eligibility"
```

---

### Task 3: Make ActionPanel and order review consume eligibility

**Files:**
- Modify: `web-ui/src/components/domain/workspace/ActionPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/ActionPanel.test.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx`
- Modify: `web-ui/src/features/persistence/mode.ts` or read its existing exported mode helper
- Modify: `web-ui/src/i18n/messages.en.ts` only if no existing safe blocked-copy key fits

**Interfaces:**
- Consumes: `resolveOrderEligibility()` from Task 2.
- Produces: no order form for blocked candidates; OrderReviewExperience receives already validated initial values and performs a defensive recheck before submit.

- [ ] **Step 1: Invert the incorrect SKIP component test**

Replace the existing expectation in `ActionPanel.test.tsx` with:

```typescript
it('does not expose order review when backend guidance is SKIP', () => {
  setCandidate({ suggestedOrderType: 'SKIP' });
  renderWithProviders(<ActionPanel ticker="AAPL" />);

  expect(screen.getAllByText(/currently not an actionable entry/i).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: t('order.candidateModal.createAction') })).not.toBeInTheDocument();
});
```

Add component cases for missing entry, missing stop, zero shares, inverted stop, absent API token, and valid local-mode candidate.

- [ ] **Step 2: Run ActionPanel tests and verify RED**

Run:

```bash
cd web-ui && npx vitest run src/components/domain/workspace/ActionPanel.test.tsx
```

Expected: the SKIP test finds an enabled Create Order button and malformed plans still render the form.

- [ ] **Step 3: Build the eligibility input once in ActionPanel**

Resolve plan values using backend recommendation risk first, then canonical candidate fields, without numeric defaults:

```typescript
const eligibility = resolveOrderEligibility({
  workflowStatus: candidate?.recommendation?.workflowStatus,
  nextStepCode: candidate?.recommendation?.nextStep.code,
  suggestedOrderType: candidate?.suggestedOrderType,
  approvalToken: candidate?.approvalToken,
  dataStatus: candidate?.dataStatus,
  dataAsOf: candidate?.dataAsOf,
  persistenceMode: isLocalPersistenceMode() ? 'local' : 'api',
  hasOpenPosition: Boolean(openPosition),
  sameSymbolMode: candidate?.sameSymbol?.mode,
  plan: {
    entry: candidate?.suggestedOrderPrice ?? candidate?.recommendation?.risk?.entry ?? candidate?.entry,
    stop: candidate?.recommendation?.risk?.stop ?? candidate?.stop,
    target: candidate?.recommendation?.risk?.target ?? candidate?.target,
    shares: candidate?.recommendation?.risk?.shares ?? candidate?.shares,
    rewardRisk: candidate?.rr,
    currency: candidate?.quoteCurrency ?? candidate?.currency,
  },
});
```

Render OrderReviewExperience only when `eligibility.allowed`; otherwise render the existing workflow explanation without an order form.

- [ ] **Step 4: Remove fabricated defaults from OrderReviewExperience**

Delete `fallbackEntry = 100`, percentage stop fallback, minimum-share fallback, and `context.currency ?? 'USD'`. Initialize the form only from the validated values supplied by ActionPanel. Before mutation, defensively call the same eligibility function or validate the exact submitted values and return a localized blocking error without invoking the mutation when invalid.

- [ ] **Step 5: Add submit-level regression tests**

In `OrderReviewExperience.test.tsx`, pass a malformed context through a direct render and assert:

```typescript
expect(screen.queryByDisplayValue('100')).not.toBeInTheDocument();
expect(createOrder).not.toHaveBeenCalled();
```

For the complete ready context, assert the mutation receives the exact backend entry, stop, shares, currency, and approval token without fallback substitution.

- [ ] **Step 6: Run focused frontend tests and verify GREEN**

Run:

```bash
cd web-ui && npx vitest run src/features/orders/orderEligibility.test.ts src/components/domain/workspace/ActionPanel.test.tsx src/components/domain/orders/OrderReviewExperience.test.tsx
```

- [ ] **Step 7: Commit the component integration**

```bash
git add web-ui/src/components/domain/workspace/ActionPanel.tsx web-ui/src/components/domain/workspace/ActionPanel.test.tsx web-ui/src/components/domain/orders/OrderReviewExperience.tsx web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx web-ui/src/i18n/messages.en.ts
git commit -m "Block unsafe order review defaults"
```

---

### Task 4: Preserve missing plan values in reporting adapters

**Files:**
- Modify: `api/models/daily_review.py`
- Modify: `api/services/daily_review_service.py:34-64`
- Test: `tests/api/test_daily_review_service.py`
- Modify: `web-ui/src/features/dailyReview/types.ts:178-215`
- Test: `web-ui/src/features/dailyReview/types.test.ts` if present; otherwise create it
- Modify: `web-ui/src/components/domain/today/TodayActionItems.tsx:325-353`
- Test: `web-ui/src/components/domain/today/TodayActionList.test.tsx`

**Interfaces:**
- Produces nullable `entry`, `stop`, `shares`, and reward:risk through the Daily Review API and frontend adapter.
- Produces an unavailable marker instead of `0.00R` when reward:risk is absent.

- [ ] **Step 1: Write failing backend null-preservation tests**

Create a screener candidate with all optional plan values `None`, call `to_daily_review_candidate()`, and assert:

```python
assert result.entry is None
assert result.stop is None
assert result.shares is None
assert result.r_reward is None
```

- [ ] **Step 2: Run the Daily Review test and verify RED**

Run:

```bash
pytest tests/api/test_daily_review_service.py -k missing_plan -q
```

Expected: the adapter returns numeric zeros.

- [ ] **Step 3: Make API model and adapter fields nullable**

Change the four fields to `Optional[...] = None` in the Pydantic model and map the source values directly:

```python
entry=c.entry,
stop=c.stop,
shares=c.shares,
r_reward=c.rr,
```

- [ ] **Step 4: Write failing frontend adapter/render tests**

Assert `dailyReviewCandidateFromScreener()` preserves `undefined` for missing plan values and CandidateItem does not display `0.00R`:

```typescript
expect(candidate.entry).toBeUndefined();
expect(candidate.rReward).toBeUndefined();
expect(screen.queryByText(/0\.00R/)).not.toBeInTheDocument();
expect(screen.getByText(t('common.notAvailable'))).toBeInTheDocument();
```

- [ ] **Step 5: Update frontend types, adapter, and rendering**

Make the corresponding DailyReviewCandidate fields optional, remove every `?? 0` assignment, and render the localized unavailable marker when `rReward` is not finite.

- [ ] **Step 6: Run focused backend/frontend tests and verify GREEN**

Run:

```bash
pytest tests/api/test_daily_review_service.py -q
cd web-ui && npx vitest run src/features/dailyReview src/components/domain/today/TodayActionList.test.tsx
```

- [ ] **Step 7: Commit adapter corrections**

```bash
git add api/models/daily_review.py api/services/daily_review_service.py tests/api/test_daily_review_service.py web-ui/src/features/dailyReview/types.ts web-ui/src/features/dailyReview/types.test.ts web-ui/src/components/domain/today/TodayActionItems.tsx web-ui/src/components/domain/today/TodayActionList.test.tsx
git commit -m "Preserve unavailable trade plans"
```

---

### Task 5: Verify and document PR 1

**Files:**
- Modify: `web-ui/docs/WEB_UI_GUIDE.md`
- Modify: `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- Modify: `CHANGELOG.md`
- Create in session scratchpad, not commit: `prs.md`

**Interfaces:**
- Produces synchronized backend/frontend workflow documentation and PR delivery metadata.

- [ ] **Step 1: Update documentation**

Document these exact rules:

```text
SKIP guidance is never actionable and never carries an approval token.
Order review requires a canonical ready candidate or the documented pending BUY_LIMIT pullback exception, current final data, a complete finite plan, and API approval when API persistence is active.
Missing plan values render as unavailable and never receive synthetic defaults.
```

Update the guide's “only ready” wording to include the token-gated pending pullback exception.

- [ ] **Step 2: Record the user-visible fix**

Under `CHANGELOG.md` → `Unreleased`, add one concise fixed entry covering skipped/incomplete candidates no longer opening order tickets.

- [ ] **Step 3: Run backend verification**

Run:

```bash
pytest tests/api/test_candidate_approval.py tests/test_screener_service.py tests/api/test_daily_review_service.py -q
pytest -m "not integration" -q
ruff check api/services/screener_service.py api/services/daily_review_service.py tests/api/test_candidate_approval.py tests/test_screener_service.py tests/api/test_daily_review_service.py
```

- [ ] **Step 4: Run frontend verification**

Run:

```bash
cd web-ui
npx vitest run src/features/orders/orderEligibility.test.ts src/components/domain/workspace/ActionPanel.test.tsx src/components/domain/orders/OrderReviewExperience.test.tsx src/features/dailyReview src/components/domain/today/TodayActionList.test.tsx
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:coverage
```

- [ ] **Step 5: Verify the complete diff**

Run:

```bash
git diff --check origin/main..HEAD
git status --short
git diff --stat origin/main..HEAD
```

Confirm the diff contains only PR 1 files and no run-identity, cache-composition, or accessibility work from later PRs.

- [ ] **Step 6: Capture the changed UI**

Run the existing local API/UI workflow, capture one screenshot showing a skipped candidate with no order action and one showing an incomplete plan as unavailable. Add them under `Screenshots` in the PR description. If the environment cannot start the UI, record the exact limitation in that section.

- [ ] **Step 7: Commit documentation**

```bash
git add api/README.md web-ui/docs/WEB_UI_GUIDE.md web-ui/docs/WEB_UI_ARCHITECTURE.md CHANGELOG.md
git commit -m "Document fail-closed order review"
```
