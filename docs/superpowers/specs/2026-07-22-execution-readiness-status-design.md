# Execution Readiness Status Design

## Goal

Replace the misleading binary `Setup passes` / `Setup fails` presentation with
an execution-readiness status that distinguishes a valid conditional setup from
an invalid or incomplete trade plan. Preserve every backend execution-safety
gate and the existing recommendation API contract.

## Root cause and history

The labels `Setup passes` and `Setup fails` were introduced on 2026-05-16 in
commit `fdcebaa5`. At that time the binary recommendation verdict broadly
matched the setup presentation.

Commit `9bbd2d4` on 2026-07-19 separated setup qualification from observed entry
triggers and reconciled plans. It intentionally made `BUY_ON_PULLBACK` and
`WAIT_FOR_BREAKOUT` return `NOT_RECOMMENDED` until their triggers occur. The
frontend continued translating every `NOT_RECOMMENDED` verdict as `Setup
fails`, even when `decision_gates.setup.status` was `PASS` and
`decision_gates.trigger.status` was `WAIT`. The existing Last Run and Today
surfaces therefore began showing the contradiction as soon as `9bbd2d4` was
introduced.

## Approaches considered

1. Rename `Setup fails` to `Not ready`. This is backwards compatible but does
   not tell the operator whether the trigger, plan, or setup is responsible.
2. Derive an execution-readiness presentation from the existing decision
   gates. This uses the model already enforced by the backend, requires no API
   migration, and provides precise operator guidance.
3. Expand the backend recommendation verdict enum. This would duplicate the
   decision-gate model and require an unnecessary cross-layer contract change.

The project adopts option 2.

## Readiness model

The frontend derives one presentation-only readiness state in this precedence
order:

| Condition | State | Label |
| --- | --- | --- |
| Gate data is absent | Legacy verdict fallback | See below |
| `setup.status == BLOCK` | `NO_SETUP` | `No valid setup` |
| `setup.status == UNKNOWN` | `UNKNOWN` | `Readiness unknown` |
| `trigger.status == WAIT` | `WAITING_FOR_TRIGGER` | `Waiting for trigger` |
| `trigger.status == BLOCK` | `TRIGGER_BLOCKED` | `Trigger blocked` |
| `trigger.status == UNKNOWN` | `UNKNOWN` | `Readiness unknown` |
| `plan.status == UNKNOWN` | `PLAN_INCOMPLETE` | `Plan incomplete` |
| `plan.status == BLOCK` | `PLAN_BLOCKED` | `Plan blocked` |
| Setup, trigger, and plan are all `PASS` | `READY_FOR_REVIEW` | `Ready for order review` |

The portfolio gate is deliberately excluded. Portfolio permission is evaluated
with current account state during order review, so a screener row must never
claim `Ready to order`. The existing backend verdict, approval token, and order
service remain authoritative for execution.

For pre-gate cached/API data, the compatibility fallback maps `RECOMMENDED` to
`Ready for order review`, `NOT_RECOMMENDED` to `Not ready`, and a missing or
unknown verdict to `Readiness unknown`. The fallback must not infer a more
specific cause without evidence.

## Frontend boundaries

A pure helper in the recommendation domain will derive the readiness state,
label key, and visual tone from `DecisionGateState` plus the legacy verdict.
`RecommendationBadge` will consume this helper and accept the decision gates.
The screener candidate view model and identity cell will pass the gate data
through instead of discarding it.

The Last Run filter currently called `Recommended only` will be renamed `Ready
only`; its behavior remains the strict legacy recommendation filter because
that is the set allowed to proceed to order review. Order-action tooltips will
describe the derived readiness state instead of treating every
`NOT_RECOMMENDED` candidate as a failed setup.

The Today action badge remains the canonical decision instruction (`Buy on
Pullback`, `Watch`, and similar). Today may therefore show a valid opportunity
that is waiting for its execution trigger, without contradicting Last Run.

## Logic audit scope

The implementation audit covers all consumers of `verdict`, `decision_gates`,
and `decisionSummary.action`:

- Candidate approval token issuance continues to require `RECOMMENDED` plus
  passing setup, trigger, and plan gates.
- Order review continues to enforce recommendation and gate checks.
- Same-symbol add-on/re-entry eligibility continues to require the strict
  recommendation verdict.
- Candidate prioritization continues to use decision action and conviction.
- The strict candidate filter keeps its behavior but receives readiness-based
  copy.
- No backend state, persisted schema, strategy configuration, or execution
  behavior changes.

Any consumer that displays readiness will use the shared derivation helper.
Consumers that enforce trade permission will continue using backend verdicts
and gates directly.

## Testing

Frontend unit tests will cover every readiness state, the legacy fallback, the
conditional pullback regression, badge rendering, candidate gate propagation,
filter copy, and order-action tooltip behavior. Existing backend tests must
continue proving that conditional entries have setup `PASS`, trigger `WAIT`,
`ready_to_order == false`, and verdict `NOT_RECOMMENDED`.

Verification includes scoped Vitest tests, frontend typecheck and lint, the
focused backend recommendation test, the broader relevant frontend suite, and
the production frontend build. Because visible copy changes, delivery includes
a screenshot of Last Run showing a conditional candidate as `Waiting for
trigger`.
