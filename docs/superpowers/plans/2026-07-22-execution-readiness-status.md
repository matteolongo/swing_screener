# Execution Readiness Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace binary setup verdict copy with precise gate-derived execution readiness while preserving every backend order-safety decision.

**Architecture:** Add one pure frontend readiness derivation helper over the existing `DecisionGateState`, then make badges, screener tooltips, filters, and order-review presentation consume it. Enforcement code continues to use the backend `verdict`, approval token, and decision gates directly; no API or persisted-state contract changes.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, Python 3.11, pytest, existing i18n message catalog.

## Global Constraints

- Preserve `RECOMMENDED` / `NOT_RECOMMENDED` as the backend recommendation contract.
- Never represent a conditional entry as order-ready.
- Never include the portfolio gate in screener-time readiness; portfolio permission is evaluated during order review.
- Keep all user-facing copy in `web-ui/src/i18n/messages.en.ts`.
- Do not change strategy configuration, persisted schemas, approval-token issuance, or order-service enforcement.
- Preserve the user's unrelated working-tree changes.

---

### Task 1: Derive execution readiness from decision gates

**Files:**
- Create: `web-ui/src/components/domain/recommendation/readiness.ts`
- Create: `web-ui/src/components/domain/recommendation/readiness.test.ts`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Consumes: `DecisionGateState` and `RecommendationVerdict` from `@/types/recommendation`.
- Produces: `deriveExecutionReadiness(gates, verdict): ExecutionReadinessPresentation` with `state`, `labelKey`, and `tone`.

- [ ] **Step 1: Write the failing derivation tests**

Cover `NO_SETUP`, `UNKNOWN`, `WAITING_FOR_TRIGGER`, `TRIGGER_BLOCKED`,
`PLAN_INCOMPLETE`, `PLAN_BLOCKED`, `READY_FOR_REVIEW`, and all three legacy
fallbacks. Use a shared passing-gates fixture and change one gate per test:

```ts
const passingGates: DecisionGateState = {
  setup: { status: 'PASS', explanation: 'Setup qualifies.' },
  trigger: { status: 'PASS', explanation: 'Trigger observed.' },
  plan: { status: 'PASS', explanation: 'Plan reconciles.' },
  portfolio: { status: 'UNKNOWN', explanation: 'Checked later.' },
  readyToOrder: false,
};

expect(deriveExecutionReadiness({
  ...passingGates,
  trigger: { status: 'WAIT', explanation: 'Waiting.' },
}, 'NOT_RECOMMENDED')).toMatchObject({
  state: 'WAITING_FOR_TRIGGER',
  labelKey: 'recommendation.readiness.WAITING_FOR_TRIGGER',
  tone: 'warning',
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
cd web-ui && npm test -- --run src/components/domain/recommendation/readiness.test.ts
```

Expected: FAIL because `readiness.ts` does not exist.

- [ ] **Step 3: Implement the pure helper and i18n labels**

Define these states and precedence exactly:

```ts
export type ExecutionReadinessState =
  | 'READY_FOR_REVIEW'
  | 'WAITING_FOR_TRIGGER'
  | 'PLAN_INCOMPLETE'
  | 'PLAN_BLOCKED'
  | 'TRIGGER_BLOCKED'
  | 'NO_SETUP'
  | 'NOT_READY'
  | 'UNKNOWN';

export type ExecutionReadinessTone = 'success' | 'warning' | 'danger' | 'neutral';
```

Check setup, trigger, and plan in that order. When gates are absent, map
`RECOMMENDED` to `READY_FOR_REVIEW`, `NOT_RECOMMENDED` to `NOT_READY`, and
unknown/missing verdict to `UNKNOWN`. Add i18n labels from the approved design:
`Ready for order review`, `Waiting for trigger`, `Plan incomplete`, `Plan
blocked`, `Trigger blocked`, `No valid setup`, `Not ready`, and `Readiness
unknown`.

- [ ] **Step 4: Run the derivation test and verify GREEN**

Run the command from Step 2. Expected: all readiness tests pass.

- [ ] **Step 5: Commit the helper**

```bash
git add web-ui/src/components/domain/recommendation/readiness.ts \
  web-ui/src/components/domain/recommendation/readiness.test.ts \
  web-ui/src/i18n/messages.en.ts
git commit -m "Derive execution readiness from decision gates"
```

---

### Task 2: Replace misleading Last Run presentation

**Files:**
- Modify: `web-ui/src/components/domain/recommendation/RecommendationBadge.tsx`
- Modify: `web-ui/src/components/domain/recommendation/RecommendationBadge.test.tsx`
- Modify: `web-ui/src/features/screener/viewModel.ts`
- Modify: `web-ui/src/features/screener/viewModel.test.ts`
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidateIdentityCell.tsx`
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx`
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidatesTable.test.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Consumes: `deriveExecutionReadiness()` from Task 1.
- Produces: a badge and order-action tooltip that describe the candidate's readiness rather than its legacy verdict.

- [ ] **Step 1: Write failing badge and screener regression tests**

Add a badge test proving `NOT_RECOMMENDED` plus setup `PASS`, trigger `WAIT`,
and plan `PASS` renders `Waiting for trigger` and not `Setup fails`. Add view
model coverage proving `recommendation.decisionGates` is preserved. Add a table
test with a `BUY_ON_PULLBACK` candidate proving both the badge and Create Order
tooltip use waiting-for-trigger copy.

- [ ] **Step 2: Run scoped tests and verify RED**

```bash
cd web-ui && npm test -- --run \
  src/components/domain/recommendation/RecommendationBadge.test.tsx \
  src/features/screener/viewModel.test.ts \
  src/components/domain/screener/ScreenerCandidatesTable.test.tsx
```

Expected: the regression assertions fail because the badge still renders the
legacy verdict and the candidate view model drops gate data.

- [ ] **Step 3: Integrate readiness into the badge and candidate path**

Add `decisionGates?: DecisionGateState` to `RecommendationBadge`. Derive its
state and map readiness tones to the existing semantic token classes. Remove
the `STOP_MISSING` / `NO_SIGNAL` presentation heuristic because gate precedence
now supplies the authoritative explanation.

Add `decisionGates: DecisionGateState | undefined` to `CandidateViewModel`, set
it from `candidate.recommendation?.decisionGates`, and pass it through
`ScreenerCandidateIdentityCell`.

Replace `orderActionTitle(candidate, verdict)` with a gate-derived title. Ready
candidates keep `Create Order` / `Create Add-On Order`; non-ready candidates use
the i18n template `Execution readiness: {{status}}`.

- [ ] **Step 4: Run scoped tests and verify GREEN**

Run the Step 2 command. Expected: all scoped tests pass.

- [ ] **Step 5: Commit the Last Run integration**

```bash
git add web-ui/src/components/domain/recommendation \
  web-ui/src/components/domain/screener/ScreenerCandidateIdentityCell.tsx \
  web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx \
  web-ui/src/components/domain/screener/ScreenerCandidatesTable.test.tsx \
  web-ui/src/features/screener/viewModel.ts \
  web-ui/src/features/screener/viewModel.test.ts \
  web-ui/src/i18n/messages.en.ts
git commit -m "Show execution readiness in Last Run"
```

---

### Task 3: Align filters and order-review presentation

**Files:**
- Modify: `web-ui/src/components/domain/screener/ScreenerForm.test.tsx`
- Modify: `web-ui/src/components/domain/today/TodayActionList.test.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewSummary.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Consumes: `deriveExecutionReadiness()` and `ExecutionReadinessPresentation` from Task 1.
- Produces: readiness-consistent filter copy, warning copy, and order-review card tone without changing submission enforcement.

- [ ] **Step 1: Write failing copy and order-review tests**

Add form and Today tests asserting `Ready only` / `Ready` copy. Add an order
review test with a conditional recommendation asserting `Waiting for trigger`
appears, the summary card uses warning styling rather than danger styling, and
the decision remains locked.

- [ ] **Step 2: Run scoped tests and verify RED**

```bash
cd web-ui && npm test -- --run \
  src/components/domain/screener/ScreenerForm.test.tsx \
  src/components/domain/today/TodayActionList.test.tsx \
  src/components/domain/orders/OrderReviewExperience.test.tsx
```

Expected: copy assertions and the conditional order-review readiness assertion
fail against the legacy presentation.

- [ ] **Step 3: Update presentation while preserving enforcement**

Change visible copies behind the existing `recommendedOnly` persisted field to
`Ready only` and the Today source chip to `Ready`. Do not rename the persisted
field or change `filterCandidates()` behavior.

In `OrderReviewExperience`, derive readiness once from the recommendation and
pass it to `OrderReviewSummary`. Use it for human-facing warning text. Keep
`isRecommended`, `decisionReady`, approval token checks, locked submission, and
override rules unchanged. In `OrderReviewSummary`, use readiness tone for card
styling and pass the gates into `RecommendationBadge`.

- [ ] **Step 4: Run scoped tests and verify GREEN**

Run the Step 2 command. Expected: all scoped tests pass.

- [ ] **Step 5: Commit the aligned presentation**

```bash
git add web-ui/src/components/domain/screener/ScreenerForm.test.tsx \
  web-ui/src/components/domain/today/TodayActionList.test.tsx \
  web-ui/src/components/domain/orders/OrderReviewExperience.tsx \
  web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx \
  web-ui/src/components/domain/orders/OrderReviewSummary.tsx \
  web-ui/src/i18n/messages.en.ts
git commit -m "Align readiness copy across review flows"
```

---

### Task 4: Document, audit, and verify the complete fix

**Files:**
- Modify: `web-ui/docs/WEB_UI_GUIDE.md`
- Modify: `CHANGELOG.md`
- Create: `prs.md` in the session scratchpad directory required by the delivery environment.

**Interfaces:**
- Consumes: the complete readiness UI from Tasks 1-3.
- Produces: documented behavior, audit evidence, a screenshot, and PR delivery text.

- [ ] **Step 1: Update user-facing documentation**

Document that Last Run readiness is derived from setup/trigger/plan gates and
that Today decision actions may legitimately include conditional candidates.
Add an `Unreleased` / `Fixed` changelog entry explaining that conditional
setups no longer appear as failed setups.

- [ ] **Step 2: Run backend safety regression tests**

```bash
.venv/bin/pytest \
  tests/test_recommendation_engine.py::test_conditional_setup_is_never_ready_to_order \
  tests/api/test_candidate_approval.py -q
```

Expected: all pass, proving no conditional setup becomes executable and no
approval-token boundary changed.

- [ ] **Step 3: Run full relevant frontend verification**

```bash
cd web-ui && npm test -- --run \
  src/components/domain/recommendation \
  src/components/domain/screener \
  src/components/domain/orders/OrderReviewExperience.test.tsx \
  src/components/domain/today/TodayActionList.test.tsx \
  src/features/screener
npm run typecheck
npm run lint
npm run build
```

Expected: zero test failures, zero type errors, zero lint warnings/errors, and a
successful production build.

- [ ] **Step 4: Audit enforcement consumers**

Review the final diff and re-run searches for `verdict`, `decisionGates`, and
`readyToOrder`. Confirm approval tokens, order submission, and same-symbol
eligibility still use strict backend enforcement while every human-facing
readiness display uses the shared helper.

- [ ] **Step 5: Capture the required UI screenshot**

Run `.venv/bin/python -m uvicorn api.main:app --port 8000` and
`cd web-ui && npm run dev -- --host 127.0.0.1`, open `/today`, select Last Run,
and capture a row where action is `Buy on Pullback` and readiness is `Waiting
for trigger`. Save it as `out/screenshots/execution-readiness-last-run.png` and
reference that path in the PR description. If no browser executable or capture
tool is installed, state that exact limitation in the PR `Screenshots` section.

- [ ] **Step 6: Commit documentation and final checks**

```bash
git add CHANGELOG.md web-ui/docs/WEB_UI_GUIDE.md
git diff --cached --check
git commit -m "Document execution readiness states"
```

- [ ] **Step 7: Write `prs.md`**

Use base `main`, head `fix/execution-readiness-status`, an imperative title,
the root cause date/commits, verification results, and the screenshot section:

```text
https://github.com/matteolongo/swing_screener/compare/main...fix/execution-readiness-status?expand=1

Show execution readiness instead of setup failure

Derive Last Run and order-review status from the existing setup, trigger, and plan gates. Conditional pullback and breakout candidates now read `Waiting for trigger`, while execution enforcement remains unchanged.

Document that the contradiction began with `9bbd2d4` on 2026-07-19, when conditional setups correctly became non-order-ready but retained the older `Setup fails` presentation.

## Validation

- `.venv/bin/pytest tests/test_recommendation_engine.py::test_conditional_setup_is_never_ready_to_order tests/api/test_candidate_approval.py -q`
- `cd web-ui && npm test -- --run src/components/domain/recommendation src/components/domain/screener src/components/domain/orders/OrderReviewExperience.test.tsx src/components/domain/today/TodayActionList.test.tsx src/features/screener`
- `cd web-ui && npm run typecheck && npm run lint && npm run build`

## Screenshots

- `out/screenshots/execution-readiness-last-run.png`
```
