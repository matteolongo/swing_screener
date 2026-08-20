# Coherent Execution Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace conflicting setup and buy labels with one backend-authoritative workflow status and one concrete next action across the screener and order-review experience.

**Architecture:** A new pure risk-domain classifier converts setup, plan, and trigger gates into `workflow_status` and `next_step` on every recommendation. The API serializes those additive fields, the frontend transforms them once at the snake_case/camelCase boundary, and shared presentation helpers drive grouping, copy, badges, and order-review eligibility without re-deriving gate precedence in components.

**Tech Stack:** Python 3.11+, frozen dataclasses, Pydantic v2, FastAPI, pytest, React 18, TypeScript, Vitest, React Testing Library, Tailwind semantic tokens, repository i18n helpers.

## Global Constraints

- Preserve the deterministic, end-of-day, manual-execution product boundary; add no broker API, automatic execution, ML, or intraday strategy logic.
- `workflow_status` is exactly `ready | waiting_trigger | needs_review | no_setup`.
- `next_step.code` is exactly `review_order | wait_pullback | wait_breakout_close | define_target | refresh_data | fix_stop | inspect_gate_conflict | observe`.
- Only `ready` may open candidate order review; it still requires existing portfolio checks, approval tokens, and manual confirmation.
- Missing, unknown, or contradictory workflow data resolves to `needs_review` with a safe next step, never `ready`.
- An explicit setup block takes precedence over all downstream gates and resolves to `no_setup` / `observe`.
- A waiting trigger resolves to `waiting_trigger` only when setup and plan pass and its price and currency are present.
- Preserve `decisionSummary.action` for API compatibility, but never use it for workflow grouping, badges, entry-signal fallback, order-tab visibility, or order eligibility.
- Preserve existing `intraday` versus `final_close` labeling.
- Transform snake_case to camelCase only in existing API boundary functions.
- Route all user-facing frontend copy through `web-ui/src/i18n/` and use semantic design tokens.
- API and frontend contract changes must remain in the same implementation branch and PR.
- Do not modify or include unrelated working-tree changes in `config/user.yaml`, universe data files, universe tests, or `autho0_access_token.sh`.
- Do not create commits unless the user authorizes commits for the implementation session; when authorized, use the commit steps below and stage only the listed files.

---

### Task 1: Add the canonical backend workflow classifier

**Files:**
- Create: `src/swing_screener/risk/recommendations/workflow.py`
- Create: `tests/test_execution_workflow.py`
- Modify: `src/swing_screener/risk/recommendations/engine.py`
- Modify: `api/models/recommendation.py`
- Modify: `tests/test_recommendation_engine.py`

**Interfaces:**
- Consumes: setup, trigger, and plan gate status strings; raw setup signal; entry/trigger price; quote currency; recommendation reason codes.
- Produces: `derive_execution_workflow(...) -> ExecutionWorkflow`, where `ExecutionWorkflow.status` is a `WorkflowStatus` and `ExecutionWorkflow.next_step` is an `ExecutionNextStep`.
- Produces API fields: `Recommendation.workflow_status` and `Recommendation.next_step`.

- [ ] **Step 1: Write table-driven failing classifier tests**

Create `tests/test_execution_workflow.py`:

```python
import pytest

from swing_screener.risk.recommendations.workflow import derive_execution_workflow


@pytest.mark.parametrize(
    (
        "setup",
        "trigger",
        "plan",
        "signal",
        "price",
        "currency",
        "reason_codes",
        "expected_status",
        "expected_code",
    ),
    [
        ("BLOCK", "WAIT", "PASS", "none", 100.0, "USD", [], "no_setup", "observe"),
        ("UNKNOWN", "PASS", "PASS", "breakout", 100.0, "USD", [], "needs_review", "inspect_gate_conflict"),
        ("PASS", "PASS", "UNKNOWN", "breakout", 100.0, "USD", ["TARGET_NOT_VALIDATED"], "needs_review", "define_target"),
        ("PASS", "PASS", "BLOCK", "breakout", 100.0, "USD", ["STOP_INVALID"], "needs_review", "fix_stop"),
        ("PASS", "PASS", "BLOCK", "breakout", 100.0, "USD", ["DATA_NOT_CURRENT"], "needs_review", "refresh_data"),
        ("PASS", "BLOCK", "PASS", "breakout", 100.0, "USD", [], "needs_review", "inspect_gate_conflict"),
        ("PASS", "WAIT", "PASS", "BUY_ON_PULLBACK", 98.5, "USD", [], "waiting_trigger", "wait_pullback"),
        ("PASS", "WAIT", "PASS", "WAIT_FOR_BREAKOUT", 105.0, "EUR", [], "waiting_trigger", "wait_breakout_close"),
        ("PASS", "WAIT", "PASS", "BUY_ON_PULLBACK", 0.0, "USD", [], "needs_review", "refresh_data"),
        ("PASS", "WAIT", "PASS", "BUY_ON_PULLBACK", 98.5, "UNKNOWN", [], "needs_review", "refresh_data"),
        ("PASS", "PASS", "PASS", "breakout", 100.0, "USD", [], "ready", "review_order"),
    ],
)
def test_execution_workflow_precedence(
    setup,
    trigger,
    plan,
    signal,
    price,
    currency,
    reason_codes,
    expected_status,
    expected_code,
):
    result = derive_execution_workflow(
        setup_status=setup,
        trigger_status=trigger,
        plan_status=plan,
        signal=signal,
        trigger_price=price,
        currency=currency,
        reason_codes=reason_codes,
    )

    assert result.status == expected_status
    assert result.next_step.code == expected_code


def test_waiting_workflow_carries_nonlocalized_parameters():
    result = derive_execution_workflow(
        setup_status="PASS",
        trigger_status="WAIT",
        plan_status="PASS",
        signal="BUY_ON_PULLBACK",
        trigger_price=98.5,
        currency="USD",
        reason_codes=[],
    )

    assert result.next_step.trigger_price == 98.5
    assert result.next_step.currency == "USD"
```

- [ ] **Step 2: Run the classifier tests and verify the expected import failure**

Run:

```bash
pytest tests/test_execution_workflow.py -q
```

Expected: collection fails with `ModuleNotFoundError: No module named 'swing_screener.risk.recommendations.workflow'`.

- [ ] **Step 3: Implement the pure classifier**

Create `src/swing_screener/risk/recommendations/workflow.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal, Optional


WorkflowStatus = Literal["ready", "waiting_trigger", "needs_review", "no_setup"]
NextStepCode = Literal[
    "review_order",
    "wait_pullback",
    "wait_breakout_close",
    "define_target",
    "refresh_data",
    "fix_stop",
    "inspect_gate_conflict",
    "observe",
]


@dataclass(frozen=True)
class ExecutionNextStep:
    code: NextStepCode
    trigger_price: Optional[float] = None
    currency: Optional[str] = None


@dataclass(frozen=True)
class ExecutionWorkflow:
    status: WorkflowStatus
    next_step: ExecutionNextStep


_STOP_REASONS = {"STOP_MISSING", "STOP_INVALID"}
_TARGET_REASONS = {"TARGET_NOT_VALIDATED", "RR_TOO_LOW"}
_DATA_REASONS = {"DATA_NOT_CURRENT", "CURRENCY_UNKNOWN", "FX_RATE_MISSING"}


def _needs_review_code(reason_codes: set[str]) -> NextStepCode:
    if reason_codes & _STOP_REASONS:
        return "fix_stop"
    if reason_codes & _TARGET_REASONS:
        return "define_target"
    if reason_codes & _DATA_REASONS:
        return "refresh_data"
    return "inspect_gate_conflict"


def derive_execution_workflow(
    *,
    setup_status: str,
    trigger_status: str,
    plan_status: str,
    signal: Optional[str],
    trigger_price: Optional[float],
    currency: Optional[str],
    reason_codes: Iterable[str],
) -> ExecutionWorkflow:
    reasons = set(reason_codes)

    if setup_status == "BLOCK":
        return ExecutionWorkflow("no_setup", ExecutionNextStep("observe"))
    if setup_status != "PASS":
        return ExecutionWorkflow(
            "needs_review", ExecutionNextStep("inspect_gate_conflict")
        )

    if plan_status != "PASS":
        return ExecutionWorkflow(
            "needs_review", ExecutionNextStep(_needs_review_code(reasons))
        )

    if trigger_status == "WAIT":
        code: NextStepCode
        if signal == "BUY_ON_PULLBACK":
            code = "wait_pullback"
        elif signal == "WAIT_FOR_BREAKOUT":
            code = "wait_breakout_close"
        else:
            return ExecutionWorkflow(
                "needs_review", ExecutionNextStep("inspect_gate_conflict")
            )

        normalized_currency = str(currency or "").strip().upper()
        if (
            trigger_price is None
            or trigger_price <= 0
            or normalized_currency in {"", "UNKNOWN"}
        ):
            return ExecutionWorkflow(
                "needs_review", ExecutionNextStep("refresh_data")
            )
        return ExecutionWorkflow(
            "waiting_trigger",
            ExecutionNextStep(
                code,
                trigger_price=round(float(trigger_price), 4),
                currency=normalized_currency,
            ),
        )

    if trigger_status != "PASS":
        return ExecutionWorkflow(
            "needs_review", ExecutionNextStep("inspect_gate_conflict")
        )

    return ExecutionWorkflow("ready", ExecutionNextStep("review_order"))
```

- [ ] **Step 4: Run the classifier tests and verify they pass**

Run:

```bash
pytest tests/test_execution_workflow.py -q
```

Expected: `12 passed`.

- [ ] **Step 5: Write failing engine and API-model integration assertions**

Append to `tests/test_recommendation_engine.py`:

```python
from dataclasses import asdict

from api.models.recommendation import Recommendation


def test_recommendation_exposes_canonical_ready_workflow():
    rec = build_recommendation(
        signal="breakout",
        entry=100.0,
        stop=95.0,
        target=110.0,
        target_source="structural",
        shares=10,
        account_size=10000.0,
        risk_pct_target=0.01,
        rr_target=2.0,
    )

    assert rec.workflow_status == "ready"
    assert rec.next_step.code == "review_order"
    api_rec = Recommendation.model_validate(asdict(rec))
    assert api_rec.workflow_status == "ready"
    assert api_rec.next_step.code == "review_order"


def test_no_signal_cannot_be_promoted_by_later_analysis():
    rec = build_recommendation(
        signal="none",
        entry=100.0,
        stop=95.0,
        target=110.0,
        target_source="structural",
        shares=10,
        account_size=10000.0,
        risk_pct_target=0.01,
        rr_target=2.0,
    )

    assert rec.decision_gates.setup.status == "BLOCK"
    assert rec.workflow_status == "no_setup"
    assert rec.next_step.code == "observe"
```

- [ ] **Step 6: Run the integration tests and verify the missing-field failure**

Run:

```bash
pytest tests/test_recommendation_engine.py -q
```

Expected: the new tests fail because `RecommendationPayload` has no `workflow_status` or `next_step`.

- [ ] **Step 7: Add workflow fields to the domain and API recommendation models**

In `src/swing_screener/risk/recommendations/engine.py`:

```python
from swing_screener.risk.recommendations.workflow import (
    ExecutionNextStep,
    WorkflowStatus,
    derive_execution_workflow,
)
```

Add these fields to `RecommendationPayload` immediately after `decision_gates`:

```python
    workflow_status: WorkflowStatus
    next_step: ExecutionNextStep
```

After `decision_gates` is built, derive the workflow:

```python
    workflow = derive_execution_workflow(
        setup_status=decision_gates.setup.status,
        trigger_status=decision_gates.trigger.status,
        plan_status=decision_gates.plan.status,
        signal=signal,
        trigger_price=entry if entry > 0 else None,
        currency=quote_currency,
        reason_codes=(reason.code for reason in reasons_detailed),
    )
```

Add these arguments to the final `RecommendationPayload(...)` call:

```python
        workflow_status=workflow.status,
        next_step=workflow.next_step,
```

In `api/models/recommendation.py`, add:

```python
WorkflowStatus = Literal["ready", "waiting_trigger", "needs_review", "no_setup"]
NextStepCode = Literal[
    "review_order",
    "wait_pullback",
    "wait_breakout_close",
    "define_target",
    "refresh_data",
    "fix_stop",
    "inspect_gate_conflict",
    "observe",
]


class ExecutionNextStepModel(BaseModel):
    code: NextStepCode
    trigger_price: Optional[float] = None
    currency: Optional[str] = None
```

Add to `Recommendation` after `decision_gates`:

```python
    workflow_status: WorkflowStatus = "needs_review"
    next_step: ExecutionNextStepModel = Field(
        default_factory=lambda: ExecutionNextStepModel(code="refresh_data")
    )
```

- [ ] **Step 8: Run backend workflow and approval-token regression tests**

Run:

```bash
pytest tests/test_execution_workflow.py tests/test_recommendation_engine.py tests/api/test_candidate_approval.py -q
```

Expected: all tests pass; existing approval-token eligibility still requires the original PASS gates.

- [ ] **Step 9: Commit Task 1 only when commit authorization is active**

```bash
git add src/swing_screener/risk/recommendations/workflow.py src/swing_screener/risk/recommendations/engine.py api/models/recommendation.py tests/test_execution_workflow.py tests/test_recommendation_engine.py
git commit -m "Add canonical execution workflow classification"
```

---

### Task 2: Transform and present the workflow contract in one frontend boundary

**Files:**
- Create: `web-ui/src/types/recommendation.test.ts`
- Create: `web-ui/src/components/domain/recommendation/workflowPresentation.ts`
- Create: `web-ui/src/components/domain/recommendation/workflowPresentation.test.ts`
- Modify: `web-ui/src/types/recommendation.ts`
- Modify: `web-ui/src/components/domain/recommendation/RecommendationBadge.tsx`
- Modify: `web-ui/src/components/domain/recommendation/RecommendationBadge.test.tsx`
- Delete after consumers migrate in Task 4: `web-ui/src/components/domain/recommendation/readiness.ts`
- Delete after consumers migrate in Task 4: `web-ui/src/components/domain/recommendation/readiness.test.ts`

**Interfaces:**
- Consumes: `RecommendationAPI.workflow_status` and `RecommendationAPI.next_step`.
- Produces: `Recommendation.workflowStatus`, `Recommendation.nextStep`, `getWorkflowPresentation()`, `formatWorkflowNextStep()`, and `groupCandidatesByWorkflow()`.
- Safe fallback: absent API fields become `needs_review` / `refresh_data`.

- [ ] **Step 1: Write failing boundary-transform tests**

Create `web-ui/src/types/recommendation.test.ts` with a complete minimal API fixture:

```typescript
import { describe, expect, it } from 'vitest';
import { transformRecommendation, type RecommendationAPI } from './recommendation';

const base: RecommendationAPI = {
  verdict: 'NOT_RECOMMENDED',
  reasons_short: [],
  reasons_detailed: [],
  risk: {
    entry: 98.5,
    risk_amount: 10,
    risk_pct: 0.01,
    position_size: 985,
    shares: 10,
  },
  costs: {
    commission_estimate: 0,
    fx_estimate: 0,
    slippage_estimate: 0,
    total_cost: 0,
  },
  checklist: [],
  education: {
    common_bias_warning: '',
    what_to_learn: '',
    what_would_make_valid: [],
  },
};

describe('transformRecommendation workflow contract', () => {
  it('maps canonical snake_case fields', () => {
    const result = transformRecommendation({
      ...base,
      workflow_status: 'waiting_trigger',
      next_step: { code: 'wait_pullback', trigger_price: 98.5, currency: 'USD' },
    });

    expect(result.workflowStatus).toBe('waiting_trigger');
    expect(result.nextStep).toEqual({
      code: 'wait_pullback',
      triggerPrice: 98.5,
      currency: 'USD',
    });
  });

  it('fails safely when an older backend omits workflow fields', () => {
    const result = transformRecommendation(base);

    expect(result.workflowStatus).toBe('needs_review');
    expect(result.nextStep).toEqual({ code: 'refresh_data' });
  });
});
```

- [ ] **Step 2: Run the transform test and verify the type failure**

Run:

```bash
cd web-ui && npx vitest run src/types/recommendation.test.ts
```

Expected: TypeScript reports unknown `workflow_status` / `next_step` properties.

- [ ] **Step 3: Add the API and UI workflow types at the existing boundary**

In `web-ui/src/types/recommendation.ts`, add:

```typescript
export type WorkflowStatus = 'ready' | 'waiting_trigger' | 'needs_review' | 'no_setup';
export type NextStepCode =
  | 'review_order'
  | 'wait_pullback'
  | 'wait_breakout_close'
  | 'define_target'
  | 'refresh_data'
  | 'fix_stop'
  | 'inspect_gate_conflict'
  | 'observe';

export interface WorkflowNextStep {
  code: NextStepCode;
  triggerPrice?: number;
  currency?: string;
}

export interface WorkflowNextStepAPI {
  code: NextStepCode;
  trigger_price?: number | null;
  currency?: string | null;
}
```

Add to `Recommendation`:

```typescript
  workflowStatus: WorkflowStatus;
  nextStep: WorkflowNextStep;
```

Add to `RecommendationAPI`:

```typescript
  workflow_status?: WorkflowStatus;
  next_step?: WorkflowNextStepAPI;
```

Add to `transformRecommendation()`:

```typescript
    workflowStatus: api.workflow_status ?? 'needs_review',
    nextStep: api.next_step
      ? {
          code: api.next_step.code,
          triggerPrice: api.next_step.trigger_price ?? undefined,
          currency: api.next_step.currency ?? undefined,
        }
      : { code: 'refresh_data' },
```

- [ ] **Step 4: Run the boundary test and verify it passes**

Run:

```bash
cd web-ui && npx vitest run src/types/recommendation.test.ts
```

Expected: `2 passed`.

- [ ] **Step 5: Write failing shared-presentation tests**

Create `web-ui/src/components/domain/recommendation/workflowPresentation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { ScreenerCandidate } from '@/features/screener/types';
import {
  formatWorkflowNextStep,
  getWorkflowPresentation,
  groupCandidatesByWorkflow,
} from './workflowPresentation';

describe('workflow presentation', () => {
  it('formats a concrete pullback instruction', () => {
    expect(formatWorkflowNextStep({
      code: 'wait_pullback',
      triggerPrice: 46.2,
      currency: 'EUR',
    })).toContain('€46.20');
  });

  it('maps an absent recommendation to safe review', () => {
    expect(getWorkflowPresentation(undefined)).toMatchObject({
      status: 'needs_review',
      tone: 'danger',
    });
  });

  it('groups in workflow order while preserving priority inside a group', () => {
    const candidate = (ticker: string, workflowStatus: string) => ({
      ticker,
      recommendation: {
        workflowStatus,
        nextStep: { code: workflowStatus === 'ready' ? 'review_order' : 'observe' },
      },
    } as ScreenerCandidate);
    const groups = groupCandidatesByWorkflow([
      candidate('OBS', 'no_setup'),
      candidate('READY-1', 'ready'),
      candidate('READY-2', 'ready'),
    ]);

    expect(groups.map((group) => group.status)).toEqual([
      'ready', 'waiting_trigger', 'needs_review', 'no_setup',
    ]);
    expect(groups[0].candidates.map((item) => item.ticker)).toEqual(['READY-1', 'READY-2']);
  });
});
```

- [ ] **Step 6: Run the presentation test and verify the import failure**

Run:

```bash
cd web-ui && npx vitest run src/components/domain/recommendation/workflowPresentation.test.ts
```

Expected: collection fails because `workflowPresentation.ts` does not exist.

- [ ] **Step 7: Implement the shared workflow presentation helper**

Create `web-ui/src/components/domain/recommendation/workflowPresentation.ts`:

```typescript
import type { MessageKey } from '@/i18n/types';
import { t } from '@/i18n/t';
import type { ScreenerCandidate } from '@/features/screener/types';
import type {
  Recommendation,
  WorkflowNextStep,
  WorkflowStatus,
} from '@/types/recommendation';
import { formatCurrency } from '@/utils/formatters';

export type WorkflowTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface WorkflowPresentation {
  status: WorkflowStatus;
  labelKey: MessageKey;
  groupTitleKey: MessageKey;
  groupDescriptionKey: MessageKey;
  tone: WorkflowTone;
}

const PRESENTATIONS: Record<WorkflowStatus, WorkflowPresentation> = {
  ready: {
    status: 'ready',
    labelKey: 'recommendation.workflow.status.ready',
    groupTitleKey: 'screener.workflowGroups.ready.title',
    groupDescriptionKey: 'screener.workflowGroups.ready.description',
    tone: 'success',
  },
  waiting_trigger: {
    status: 'waiting_trigger',
    labelKey: 'recommendation.workflow.status.waitingTrigger',
    groupTitleKey: 'screener.workflowGroups.waitingTrigger.title',
    groupDescriptionKey: 'screener.workflowGroups.waitingTrigger.description',
    tone: 'warning',
  },
  needs_review: {
    status: 'needs_review',
    labelKey: 'recommendation.workflow.status.needsReview',
    groupTitleKey: 'screener.workflowGroups.needsReview.title',
    groupDescriptionKey: 'screener.workflowGroups.needsReview.description',
    tone: 'danger',
  },
  no_setup: {
    status: 'no_setup',
    labelKey: 'recommendation.workflow.status.noSetup',
    groupTitleKey: 'screener.workflowGroups.noSetup.title',
    groupDescriptionKey: 'screener.workflowGroups.noSetup.description',
    tone: 'neutral',
  },
};

export const WORKFLOW_ORDER: WorkflowStatus[] = [
  'ready',
  'waiting_trigger',
  'needs_review',
  'no_setup',
];

export function getWorkflowPresentation(
  recommendation?: Pick<Recommendation, 'workflowStatus'>,
): WorkflowPresentation {
  return PRESENTATIONS[recommendation?.workflowStatus ?? 'needs_review'];
}

export function formatWorkflowNextStep(nextStep?: WorkflowNextStep): string {
  const safeStep = nextStep ?? { code: 'refresh_data' as const };
  if (safeStep.code === 'wait_pullback' || safeStep.code === 'wait_breakout_close') {
    if (safeStep.triggerPrice == null || !safeStep.currency) {
      return t('recommendation.workflow.nextStep.refresh_data');
    }
    const price = formatCurrency(safeStep.triggerPrice, safeStep.currency);
    return safeStep.code === 'wait_pullback'
      ? t('recommendation.workflow.nextStep.wait_pullback', { price })
      : t('recommendation.workflow.nextStep.wait_breakout_close', { price });
  }
  return t(`recommendation.workflow.nextStep.${safeStep.code}` as MessageKey);
}

export function groupCandidatesByWorkflow(candidates: ScreenerCandidate[]) {
  return WORKFLOW_ORDER.map((status) => ({
    status,
    presentation: PRESENTATIONS[status],
    candidates: candidates.filter(
      (candidate) => (candidate.recommendation?.workflowStatus ?? 'needs_review') === status,
    ),
  }));
}
```

Add the exact keys referenced above to `web-ui/src/i18n/messages.en.ts`. Use these English values:

```typescript
workflow: {
  status: {
    ready: 'Ready for order review',
    waitingTrigger: 'Waiting for trigger',
    needsReview: 'Needs review',
    noSetup: 'Interesting, no setup',
  },
  nextStep: {
    review_order: 'Review the proposed order',
    wait_pullback: 'Wait for a pullback to {{price}}',
    wait_breakout_close: 'Wait for a close above {{price}}',
    define_target: 'Define a valid target',
    refresh_data: 'Refresh the candidate data',
    fix_stop: 'Correct the stop level',
    inspect_gate_conflict: 'Review the conflicting setup data',
    observe: 'Observe — no setup today',
  },
},
```

- [ ] **Step 8: Migrate `RecommendationBadge` to the canonical recommendation fields**

Change the props in `RecommendationBadge.tsx` to:

```typescript
interface RecommendationBadgeProps {
  recommendation?: Pick<Recommendation, 'workflowStatus' | 'nextStep'>;
  className?: string;
  showExplanation?: boolean;
}
```

Use:

```typescript
const workflow = getWorkflowPresentation(recommendation);
```

Render `t(workflow.labelKey)` and map `workflow.tone` through the existing semantic-token style map. Rewrite `RecommendationBadge.test.tsx` to construct recommendations with all four statuses plus an undefined-recommendation fallback, and assert that undefined renders `needs_review`, not a legacy verdict-derived ready state.

- [ ] **Step 9: Run the frontend contract and presentation tests**

Run:

```bash
cd web-ui && npx vitest run src/types/recommendation.test.ts src/components/domain/recommendation/workflowPresentation.test.ts src/components/domain/recommendation/RecommendationBadge.test.tsx
```

Expected: all tests pass.

- [ ] **Step 10: Commit Task 2 only when commit authorization is active**

```bash
git add web-ui/src/types/recommendation.ts web-ui/src/types/recommendation.test.ts web-ui/src/components/domain/recommendation/workflowPresentation.ts web-ui/src/components/domain/recommendation/workflowPresentation.test.ts web-ui/src/components/domain/recommendation/RecommendationBadge.tsx web-ui/src/components/domain/recommendation/RecommendationBadge.test.tsx web-ui/src/i18n/messages.en.ts
git commit -m "Map execution workflow contract in the web UI"
```

---

### Task 3: Group Last Run by the beginner-facing workflow

**Files:**
- Create: `web-ui/src/components/domain/screener/ScreenerWorkflowGroup.tsx`
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx`
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidatesTable.test.tsx`
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidateIdentityCell.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Consumes: `groupCandidatesByWorkflow()` and `formatWorkflowNextStep()` from Task 2.
- Produces: four ordered visual groups and context-specific row actions.
- Preserves: candidate input order inside each group, recurrence markers, details expansion, row selection, watchlist behavior, close, benchmark comparison, and R:R.

- [ ] **Step 1: Expand the table test fixture and write failing grouping regressions**

In `ScreenerCandidatesTable.test.tsx`, replace the single-purpose fixture with `candidate(overrides)` and add four candidates whose recommendation fields are:

```typescript
const workflows = {
  ready: { workflowStatus: 'ready', nextStep: { code: 'review_order' } },
  waiting: {
    workflowStatus: 'waiting_trigger',
    nextStep: { code: 'wait_pullback', triggerPrice: 46.2, currency: 'EUR' },
  },
  review: { workflowStatus: 'needs_review', nextStep: { code: 'define_target' } },
  noSetup: { workflowStatus: 'no_setup', nextStep: { code: 'observe' } },
} as const;
```

Add tests that assert:

```typescript
expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual([
  t('screener.workflowGroups.ready.title'),
  t('screener.workflowGroups.waitingTrigger.title'),
  t('screener.workflowGroups.needsReview.title'),
  t('screener.workflowGroups.noSetup.title'),
]);
expect(screen.getByText(t('recommendation.workflow.nextStep.wait_pullback', {
  price: '€46.20',
}))).toBeInTheDocument();
expect(screen.queryByText(t('screener.table.signalBadge.pullback'))).not.toBeInTheDocument();
expect(screen.queryByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback'))).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: t('screener.table.reviewOrderAction') })).toBeEnabled();
expect(screen.getAllByRole('button', { name: t('screener.table.reviewOrderAction') })).toHaveLength(1);
```

Add a regression candidate with `signal: 'none'`, `decisionSummary.action: 'BUY_ON_PULLBACK'`, and `workflows.noSetup`. Assert it appears only under the collapsed no-setup group and no buy copy is rendered.

- [ ] **Step 2: Run the table tests and verify they fail against the flat table**

Run:

```bash
cd web-ui && npx vitest run src/components/domain/screener/ScreenerCandidatesTable.test.tsx
```

Expected: failures for missing workflow headings and lingering signal/buy labels.

- [ ] **Step 3: Add the reusable group shell**

Create `ScreenerWorkflowGroup.tsx`:

```tsx
import type { ReactNode } from 'react';
import { t } from '@/i18n/t';
import type { WorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import { cn } from '@/utils/cn';

interface ScreenerWorkflowGroupProps {
  presentation: WorkflowPresentation;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}

const DOT_STYLES = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-muted',
} as const;

export default function ScreenerWorkflowGroup({
  presentation,
  count,
  defaultOpen,
  children,
}: ScreenerWorkflowGroupProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <details open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center gap-3 bg-foreground/5 px-4 py-3">
          <span className={cn('h-2.5 w-2.5 rounded-full', DOT_STYLES[presentation.tone])} />
          <span className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              {t(presentation.groupTitleKey)}
            </h3>
            <span className="text-xs text-muted">
              {t(presentation.groupDescriptionKey)}
            </span>
          </span>
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold text-muted">
            {count}
          </span>
        </summary>
        {children}
      </details>
    </section>
  );
}
```

- [ ] **Step 4: Replace the flat Signal table with grouped next-action tables**

In `ScreenerCandidatesTable.tsx`:

- remove `DecisionAction`, `signalBadge()`, and `deriveExecutionReadiness`;
- compute `const groups = groupCandidatesByWorkflow(candidates)`;
- render groups in a `space-y-3` container;
- keep `no_setup` closed by default and the other three open;
- show all four groups, including zero counts, for stable beginner orientation;
- replace the `Signal` header with `Next action`;
- render `formatWorkflowNextStep(candidate.recommendation?.nextStep)` in that column;
- render the setup type (`Pullback` or `Breakout`) only as muted secondary context derived from `candidate.signal`, never from `decisionSummary.action`;
- remove `RecommendationBadge` from `ScreenerCandidateIdentityCell`, because the group heading owns status;
- render the primary `Review order` button only when `workflowStatus === 'ready'`;
- for `waiting_trigger` render `Open details`, for `needs_review` render `Open verification`, and for `no_setup` render `View context`, all calling `onRecommendationDetails`;
- retain the watch toggle as a secondary observational control.

Use this gating expression exactly:

```typescript
const workflowStatus = candidate.recommendation?.workflowStatus ?? 'needs_review';
const canReviewOrder = workflowStatus === 'ready';
```

Do not call `onCreateOrder` from any non-ready branch.

- [ ] **Step 5: Add the exact group and action copy**

Add to `messages.en.ts`:

```typescript
workflowGroups: {
  ready: {
    title: 'Ready for order review',
    description: 'Setup, trigger, and plan pass. Manual confirmation is still required.',
  },
  waitingTrigger: {
    title: 'Waiting for trigger',
    description: 'The setup is valid, but the entry condition has not happened yet.',
  },
  needsReview: {
    title: 'Needs review',
    description: 'Resolve the stated problem before this candidate can advance.',
  },
  noSetup: {
    title: 'Interesting, no setup',
    description: 'Useful context may exist, but there is no executable setup today.',
  },
},
```

Add table keys: `headers.nextAction`, `reviewOrderAction`, `openDetailsAction`, `openVerificationAction`, and `viewContextAction` with the exact labels from the approved mockup.

- [ ] **Step 6: Run Last Run component tests**

Run:

```bash
cd web-ui && npx vitest run src/components/domain/screener/ScreenerCandidatesTable.test.tsx
```

Expected: grouping, collapsed no-setup behavior, next-action copy, keyboard selection, and ready-only order action all pass.

- [ ] **Step 7: Commit Task 3 only when commit authorization is active**

```bash
git add web-ui/src/components/domain/screener/ScreenerWorkflowGroup.tsx web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx web-ui/src/components/domain/screener/ScreenerCandidatesTable.test.tsx web-ui/src/components/domain/screener/ScreenerCandidateIdentityCell.tsx web-ui/src/i18n/messages.en.ts
git commit -m "Group screener candidates by next action"
```

---

### Task 4: Remove decision-action authority from review and workspace flows

**Files:**
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewSummary.tsx`
- Modify: `web-ui/src/components/domain/today/TodayActionItems.tsx`
- Modify: `web-ui/src/components/domain/today/TodayActionItems.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/ActionPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/ActionPanel.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/ManagePositionPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/ManagePositionPanel.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx`
- Modify: `web-ui/src/components/domain/recommendation/RecommendationBadge.tsx`
- Delete: `web-ui/src/components/domain/recommendation/readiness.ts`
- Delete: `web-ui/src/components/domain/recommendation/readiness.test.ts`

**Interfaces:**
- Consumes: `recommendation.workflowStatus`, `recommendation.nextStep`, `getWorkflowPresentation()`, and `formatWorkflowNextStep()`.
- Produces: consistent badge/copy and ready-only access to candidate order review or add-on entry flows.
- Preserves: server approval token validation, freshness checks, order-form risk checks, and manual ad-hoc orders with no screener candidate.

- [ ] **Step 1: Write failing order-review authority tests**

Update `waitingRecommendation` in `OrderReviewExperience.test.tsx` with:

```typescript
workflowStatus: 'waiting_trigger',
nextStep: { code: 'wait_pullback', triggerPrice: 20, currency: 'USD' },
```

Add a contradictory recommendation whose decision gates all pass but whose canonical status is `needs_review`. Assert the create button remains disabled. Add a canonical `ready` recommendation with all existing freshness fields and approval context needed by the test mode, and assert review can proceed. The core assertion is:

```typescript
expect(screen.getByRole('button', {
  name: t('order.candidateModal.createAction'),
})).toBeDisabled();
```

Keep the summary assertions in `OrderReviewExperience.test.tsx`; do not create a separate summary test file. The test name must state that gate re-derivation cannot override `workflowStatus`.

- [ ] **Step 2: Write failing Today and workspace regressions**

In `TodayActionItems.test.tsx`, create a candidate with `decisionSummary.action='BUY_ON_PULLBACK'` and `recommendation.workflowStatus='no_setup'`, `nextStep.code='observe'`. Assert the badge displays `recommendation.workflow.nextStep.observe` and does not display `Buy on Pullback`.

In `ManagePositionPanel.test.tsx`, replace the analytical-action test with:

```typescript
it('shows Add-to-position only for a canonical ready add-on', () => {
  const candidate = {
    sameSymbol: { mode: 'ADD_ON' },
    recommendation: { workflowStatus: 'ready', nextStep: { code: 'review_order' } },
    decisionSummary: { action: 'WATCH' },
  } as any;
  renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} />);
  expect(screen.getByRole('button', {
    name: t('workspacePage.panels.analysis.managePosition.add'),
  })).toBeInTheDocument();
});

it('does not promote a BUY_ON_PULLBACK opinion without ready workflow status', () => {
  const candidate = {
    sameSymbol: { mode: 'ADD_ON' },
    recommendation: { workflowStatus: 'waiting_trigger', nextStep: { code: 'wait_pullback' } },
    decisionSummary: { action: 'BUY_ON_PULLBACK' },
  } as any;
  renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} />);
  expect(screen.queryByRole('button', {
    name: t('workspacePage.panels.analysis.managePosition.add'),
  })).not.toBeInTheDocument();
});
```

Add equivalent `SymbolAnalysisContent.test.tsx` assertions for visibility of the Order tab. In `ActionPanel.test.tsx`, assert that a candidate with no raw `signal` and analytical `BUY_NOW` does not synthesize a breakout signal.

- [ ] **Step 3: Run focused tests and verify legacy-action failures**

Run:

```bash
cd web-ui && npx vitest run src/components/domain/orders/OrderReviewExperience.test.tsx src/components/domain/today/TodayActionItems.test.tsx src/components/domain/workspace/ActionPanel.test.tsx src/components/domain/workspace/ManagePositionPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx
```

Expected: new tests fail because these components still derive authority from gates or `decisionSummary.action`.

- [ ] **Step 4: Make order review consume the canonical workflow**

In `OrderReviewExperience.tsx`, replace `deriveExecutionReadiness(...)` with:

```typescript
const workflow = getWorkflowPresentation(context.recommendation);
const decisionReady = Boolean(
  context.recommendation?.workflowStatus === 'ready'
    && context.dataStatus === 'current'
    && context.dataAsOf,
);
```

Pass `workflow` to `OrderReviewSummary` and use its label/tone for warnings. Keep all existing approval-token, current-price, risk, order-type, earnings, and portfolio checks unchanged.

In `OrderReviewSummary.tsx`, render:

```tsx
<RecommendationBadge recommendation={recommendation} />
```

- [ ] **Step 5: Make Today display the canonical next step**

In `TodayActionItems.tsx`, remove `formatDecisionAction` from `candidateActionBadge()` and use:

```tsx
<span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
  {formatWorkflowNextStep(item.recommendation?.nextStep)}
</span>
```

Use the workflow tone to select success/warning/danger/neutral semantic classes rather than forcing every candidate to primary blue.

- [ ] **Step 6: Remove decision-summary promotion from workspace entry flows**

In `ActionPanel.tsx`, delete `signalFromAction()` and set:

```typescript
signal: candidate?.signal,
```

In `ManagePositionPanel.tsx`, delete `ENTRY_ACTIONS` and set:

```typescript
const canAdd = Boolean(
  candidate?.sameSymbol?.mode === 'ADD_ON'
    && candidate.recommendation?.workflowStatus === 'ready',
);
```

In `SymbolAnalysisContent.tsx`, replace the BUY-action list with:

```typescript
const canAddOn = Boolean(
  candidate?.sameSymbol?.mode === 'ADD_ON'
    && candidate.recommendation?.workflowStatus === 'ready',
);
const candidateCanReviewOrder = !candidate || candidate.recommendation?.workflowStatus === 'ready';
```

Keep the Order tab for ad-hoc/manual symbols with no candidate. For a screener candidate, include the Order tab only when `candidateCanReviewOrder`; for a held symbol require `canAddOn`.

- [ ] **Step 7: Migrate all remaining badge consumers and delete frontend gate derivation**

Use:

```bash
rg -n "deriveExecutionReadiness|decisionGates=|RecommendationBadge" web-ui/src -g '*.ts' -g '*.tsx'
```

Change every `RecommendationBadge` call to pass `recommendation={...}`. Delete `readiness.ts` and its test only after `rg` returns no consumers. Keep decision gates available in details for explanation, but do not compute workflow state from them.

- [ ] **Step 8: Run all aligned-flow tests**

Run:

```bash
cd web-ui && npx vitest run src/components/domain/recommendation src/components/domain/orders/OrderReviewExperience.test.tsx src/components/domain/today/TodayActionItems.test.tsx src/components/domain/workspace/ActionPanel.test.tsx src/components/domain/workspace/ManagePositionPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx
```

Expected: all focused tests pass, and no UI consumer promotes a decision-summary action into order eligibility.

- [ ] **Step 9: Commit Task 4 only when commit authorization is active**

```bash
git add web-ui/src/components/domain/orders/OrderReviewExperience.tsx web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx web-ui/src/components/domain/orders/OrderReviewSummary.tsx web-ui/src/components/domain/today/TodayActionItems.tsx web-ui/src/components/domain/today/TodayActionItems.test.tsx web-ui/src/components/domain/workspace/ActionPanel.tsx web-ui/src/components/domain/workspace/ActionPanel.test.tsx web-ui/src/components/domain/workspace/ManagePositionPanel.tsx web-ui/src/components/domain/workspace/ManagePositionPanel.test.tsx web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx web-ui/src/components/domain/recommendation/RecommendationBadge.tsx web-ui/src/components/domain/recommendation/readiness.ts web-ui/src/components/domain/recommendation/readiness.test.ts
git commit -m "Align review flows with workflow authority"
```

---

### Task 5: Update public documentation and release notes

**Files:**
- Modify: `api/README.md`
- Modify: `src/swing_screener/risk/README.md`
- Modify: `web-ui/docs/WEB_UI_GUIDE.md`
- Modify: `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/overview/INDEX.md` only if the spec/plan links are not already present in the working tree

**Interfaces:**
- Documents: API fields, backend classifier ownership, frontend boundary ownership, Last Run group behavior, compatibility status of `decisionSummary.action`, and safe fallback.

- [ ] **Step 1: Update the API contract documentation**

In the Screener section of `api/README.md`, add:

```markdown
Each candidate recommendation exposes additive `workflow_status` and
`next_step` fields. `workflow_status` is one of `ready`, `waiting_trigger`,
`needs_review`, or `no_setup`. `next_step` contains a stable `code` and, for
pullback/breakout waits, `trigger_price` plus `currency`. These fields are the
canonical execution-workflow authority. `decision_summary.action` remains an
analytical compatibility field and must not be used to authorize order review.
```

- [ ] **Step 2: Update the risk and frontend architecture documentation**

In `src/swing_screener/risk/README.md`, add `recommendations/workflow.py` to the file map and document the precedence table from the approved spec.

In `web-ui/docs/WEB_UI_ARCHITECTURE.md` under Contracts, add:

```markdown
- Candidate workflow state is server-authoritative. Components consume
  transformed `workflowStatus` / `nextStep`; they do not re-derive precedence
  from decision gates or `decisionSummary.action`. Missing workflow fields fail
  safely to `needs_review` / `refresh_data` at the API boundary.
```

In `web-ui/docs/WEB_UI_GUIDE.md`, replace the current Last Run readiness wording with the four ordered groups, concrete next action, collapsed no-setup section, and ready-only manual order-review action.

- [ ] **Step 3: Add the user-facing changelog entry**

Replace the existing conditional-readiness bullet under `Unreleased > Fixed` with:

```markdown
- Screener candidates now use one gate-derived workflow status and concrete next
  action across Last Run, Today, symbol details, and order review, preventing an
  analytical `Buy on Pullback` opinion from appearing beside `No valid setup`.
```

Do not modify the unrelated universe-refresh bullet.

- [ ] **Step 4: Verify documentation references and formatting**

Run:

```bash
rg -n "workflow_status|workflowStatus|Interesting, no setup|decisionSummary.action" api/README.md src/swing_screener/risk/README.md web-ui/docs/WEB_UI_GUIDE.md web-ui/docs/WEB_UI_ARCHITECTURE.md
git diff --check
```

Expected: each behavior is documented and `git diff --check` prints no errors.

- [ ] **Step 5: Commit Task 5 only when commit authorization is active**

```bash
git add api/README.md src/swing_screener/risk/README.md web-ui/docs/WEB_UI_GUIDE.md web-ui/docs/WEB_UI_ARCHITECTURE.md CHANGELOG.md docs/overview/INDEX.md
git commit -m "Document the coherent execution workflow"
```

Before committing `docs/overview/INDEX.md`, inspect `git diff -- docs/overview/INDEX.md` and stage only the spec/plan links; preserve the user's pre-existing reversible-portfolio-transfer line.

---

### Task 6: Verify behavior, capture the UI, and prepare PR delivery

**Files:**
- Create: `out/screenshots/coherent-execution-workflow-last-run.png`
- Create or update in the session scratchpad: `prs.md`

**Interfaces:**
- Produces: full verification evidence, the required UI screenshot, and a ready-to-paste PR description.

- [ ] **Step 1: Run backend focused and full tests**

Run:

```bash
pytest tests/test_execution_workflow.py tests/test_recommendation_engine.py tests/api/test_candidate_approval.py -q
pytest -q
```

Expected: both commands exit 0 with no failures.

- [ ] **Step 2: Run all frontend verification commands**

Run:

```bash
cd web-ui && npm test
cd web-ui && npm run typecheck
cd web-ui && npm run lint
cd web-ui && npm run build
```

Expected: every command exits 0; ESLint reports zero warnings.

- [ ] **Step 3: Inspect authority leaks with targeted searches**

Run:

```bash
rg -n "deriveExecutionReadiness|signalFromAction|ENTRY_ACTIONS" web-ui/src
rg -n "decisionSummary\?\.action" web-ui/src/components/domain/screener web-ui/src/components/domain/orders web-ui/src/components/domain/today web-ui/src/components/domain/workspace
```

Expected: the first search returns no results. The second can return analytical display-only uses in `NarrativeAnalysisCard.tsx` and `AnalysisDecisionStrip.tsx`; it returns no result from screener grouping, order eligibility, signal fallback, Today action badges, `ManagePositionPanel.tsx`, or order-tab visibility.

- [ ] **Step 4: Capture the required UI screenshot**

Start the API and Web UI using repository commands, load a deterministic fixture or MSW-backed state containing all four statuses, and capture Last Run at desktop width. Save:

```text
out/screenshots/coherent-execution-workflow-last-run.png
```

The screenshot must visibly include the ready, waiting, needs-review, and collapsed no-setup group headers; at least one concrete trigger-price instruction; and the ready-only `Review order` action.

- [ ] **Step 5: Review the final patch without disturbing unrelated changes**

Run:

```bash
git status --short
git diff --check
git diff --stat
git diff -- api/README.md src/swing_screener/risk web-ui/src web-ui/docs CHANGELOG.md docs/overview/INDEX.md
```

Expected: no whitespace errors; only intended execution-workflow files plus the explicitly preserved unrelated user changes are present.

- [ ] **Step 6: Write the required `prs.md` content**

Write this exact content without changing the compare base or head:

```markdown
https://github.com/matteolongo/swing_screener/compare/main...fix/execution-readiness-status?expand=1

Make execution workflow status authoritative

Derive one canonical `workflow_status` and `next_step` from setup, plan, and trigger gates, then carry that contract through the API boundary. Group Last Run into ready, waiting, verification, and no-setup sections so each candidate presents one concrete next action instead of competing setup and buy labels.

Use the same workflow authority for Today, candidate details, add-on visibility, and order review. Preserve `decisionSummary.action` as analytical compatibility context without allowing it to promote a candidate into an execution flow. Missing or incoherent workflow data fails safely to review.

Testing: `pytest -q`; `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`.

Screenshots:

- `out/screenshots/coherent-execution-workflow-last-run.png`
```

- [ ] **Step 7: Commit delivery artifacts only when commit authorization is active**

```bash
git add out/screenshots/coherent-execution-workflow-last-run.png
git commit -m "Add execution workflow screenshot"
```

Do not commit `prs.md` unless repository practice for the active session explicitly requires it inside the repository; the AGENTS instruction targets the session scratchpad.
