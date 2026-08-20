# Coherent Execution Workflow Design

**Date:** 2026-07-22
**Status:** Approved for implementation planning

## Problem

The screener can currently show `No Valid Setup` beside a decision-summary
action such as `BUY_ON_PULLBACK`. Both labels are produced by valid but
independent calculations:

- execution readiness follows the risk engine's setup, plan, and trigger gates;
- `decisionSummary.action` combines technical strength, fundamentals, and
  valuation without requiring a qualified setup.

The current branch makes the gate state more visible, but it does not resolve
this disagreement about which result is authoritative. A beginner therefore
sees two plausible instructions and cannot tell what to do next.

## Product Goal

Make every candidate answer one question clearly: **what should I do next?**

The application must distinguish an attractive stock from an actionable setup.
Fundamentals, momentum, valuation, and intelligence may rank or explain a
candidate. They must never promote it past a failed execution gate.

This remains an end-of-day, manual-execution workflow. Nothing in this design
places an order, adds intraday strategy logic, or bypasses manual order review.

## Product Principles

1. One gate-derived workflow classification is authoritative across the API and
   Web UI.
2. A candidate exposes one primary next action, not competing labels.
3. Buy language is not used as a general analytical opinion.
4. Even a fully qualified candidate is only ready for manual order review; it is
   never presented as an instruction to buy immediately.
5. Missing or incoherent execution data fails safely into human verification.
6. Intraday results retain the existing `intraday` label and are never treated
   as final end-of-day output.

## Workflow Classification

The backend derives a canonical `workflow_status` from the decision gates. The
precedence is intentional and must be implemented in this order.

| Precedence | Gate condition | `workflow_status` | User meaning |
| --- | --- | --- | --- |
| 1 | Setup is explicitly blocked | `no_setup` | Interesting context may exist, but there is no executable setup |
| 2 | Setup is not confirmed, the plan is incomplete/blocked, the trigger is invalid, or required gate data is missing | `needs_review` | A concrete problem must be resolved before the candidate can advance |
| 3 | Setup and plan pass, trigger is waiting | `waiting_trigger` | The setup is valid but its entry condition has not occurred |
| 4 | Setup, plan, and trigger all pass | `ready` | The candidate may enter manual order review |

An explicit setup block takes precedence over downstream plan data because the
candidate has no valid trade structure to repair. Any unknown combination not
covered by the table resolves to `needs_review`, never `ready`.

## Structured Next Step

Every candidate response adds these non-null fields:

```text
workflow_status: "ready" | "waiting_trigger" | "needs_review" | "no_setup"
next_step: {
  code: "review_order" | "wait_pullback" | "wait_breakout_close" |
        "define_target" | "refresh_data" | "fix_stop" |
        "inspect_gate_conflict" | "observe"
  trigger_price?: number
  currency?: string
}
```

`trigger_price` and `currency` are present only for the two wait codes. The
object contains stable codes and parameters, never localized prose.

Representative codes are:

- `review_order`
- `wait_pullback`, with a trigger price when available
- `wait_breakout_close`, with a trigger price when available
- `define_target`
- `refresh_data`
- `fix_stop`
- `inspect_gate_conflict`
- `observe`

The Web UI maps codes and parameters to i18n copy such as “Attendi il pullback
a €46,20”. If a waiting condition lacks either the price or currency needed for
a concrete instruction, the classifier returns `needs_review` with
`next_step.code=refresh_data` rather than displaying a vague waiting message.

## Authority and Compatibility

`workflow_status` and `next_step` become the only operational authority for new
consumers. `decisionSummary.action` remains temporarily in the response for
backward compatibility, but is treated as analytical context, not an execution
signal. It must not drive badges, grouping, calls to action, or order-review
eligibility.

The API documentation will mark the distinction explicitly. The frontend will
stop labeling `decisionSummary.action` as “Signal”. Removal or renaming of that
legacy field is a separate compatibility decision and is not part of this
change.

## Data Flow and Boundaries

1. Strategy and analysis modules produce the existing candidate facts.
2. The risk recommendation engine produces setup, plan, and trigger gates.
3. One backend classifier converts those gates into `workflow_status` and
   `next_step`.
4. API serializers expose the structured classification in snake case.
5. Existing boundary transforms convert it to camel case for the Web UI.
6. Shared frontend presentation helpers map the status and next-step code to
   translated labels, group order, and allowed action.
7. Last Run, candidate details, badges, and review summaries consume that same
   transformed result without re-deriving it independently.

The classifier must be a focused, deterministic unit. Presentation components
must not reproduce its precedence rules.

## Last Run Information Architecture

Last Run uses one compact table inside four ordered groups:

1. **Pronti per revisione ordine**
2. **In attesa del trigger**
3. **Richiede verifica**
4. **Interessanti, nessun setup**

Candidates preserve their existing priority order within each group. The final
`no_setup` group is visually secondary and collapsed by default to reduce noise
for beginners.

The group heading owns the workflow state. Rows do not repeat a conflicting
status beside the symbol. Each row shows:

- symbol and priority;
- one localized next action or problem to resolve;
- setup type as supporting context;
- current/close price;
- reward/risk when valid;
- one context-appropriate button.

Only `ready` exposes **Rivedi ordine**. `waiting_trigger` opens candidate details,
`needs_review` opens the relevant verification context, and `no_setup` remains
observational. Every order action continues to require the existing manual
review and approval boundary.

## Error Handling

- Missing gates, unsupported gate values, contradictory gate combinations, and
  missing parameters required by the next action produce `needs_review`.
- The reason/next-step code identifies the concrete problem when possible.
- The frontend renders a safe generic verification message for an unknown
  future code and never upgrades it to `ready`.
- If an older backend omits `workflow_status` or `next_step`, the frontend shows
  `needs_review` with the localized `refresh_data` instruction. It does not
  reimplement the classifier or expose order review.
- Data freshness remains visible. An `intraday` candidate cannot be mistaken for
  final-close output merely because its execution gates otherwise pass.

## Testing Strategy

### Backend

- Table-driven unit tests cover every supported setup/plan/trigger combination.
- Tests prove that missing and unknown values resolve to `needs_review`.
- Tests validate each next-step code and required parameter.
- API contract tests verify the additive snake-case payload.
- Regression coverage reproduces `setup=BLOCK` with analytical
  `BUY_ON_PULLBACK` and asserts canonical `no_setup`/`observe` output.

### Frontend

- Boundary-transform tests verify snake_case to camelCase conversion.
- Shared presentation tests cover every status and unknown-code fallback.
- Component tests verify group order, within-group priority, the initially
  collapsed `no_setup` section, and i18n-backed copy.
- Regression tests prove that no row displays both a failed setup and buy
  language.
- Tests prove that only `ready` exposes the manual order-review action.
- Candidate detail and summary tests assert the same status and next action as
  Last Run.

### Verification

Run the focused backend and frontend suites during development, then the full
backend tests, frontend tests, typecheck, lint, and production build before
delivery. Capture screenshots of all four groups for the PR description.

## Scope

Included:

- the canonical backend classifier;
- additive API fields and their documentation;
- frontend types and API-boundary transforms;
- shared workflow presentation mapping;
- the grouped Last Run table;
- alignment of badges, candidate details, and review summaries;
- i18n copy, automated tests, and module documentation affected by the change.

Excluded:

- strategy, ranking, or setup-detection changes;
- intraday strategy logic;
- broker integration or automatic order execution;
- new configurable heuristics;
- persistent portfolio/order schema changes;
- removal of the legacy `decisionSummary.action` field.

## Acceptance Criteria

1. The same candidate has the same workflow status and next step in the API,
   Last Run, detail view, badges, and review summaries.
2. A candidate with no valid setup never displays buy language or an order-review
   action.
3. A valid setup with an unmet trigger displays a concrete wait instruction.
4. An incomplete plan or incoherent data displays a concrete verification task.
5. Only candidates with confirmed setup, plan, and trigger can open manual order
   review.
6. The no-setup group is secondary and collapsed initially.
7. Existing intraday/final-close labeling and manual approval safeguards remain
   intact.
8. No strategy, ranking, persisted-data, or broker behavior changes.
