# Analysis Canvas UX Refactor Spec

> Status: proposed  
> Prepared: 2026-04-11  
> Scope: `web-ui` analysis canvas for `Overview`, `Fundamentals`, `Intelligence`, and `Order`

## Purpose

This document turns the current UX review into an implementation-ready refactor brief for the analysis canvas. The goal is to improve:

- usability during trade review and order creation
- information hierarchy and scan speed
- placement of critical data and actions
- consistency across tabs
- mobile and desktop flow

This is a structural refactor, not a visual redesign from scratch.

## Current Problems

The current canvas is readable and disciplined, but several patterns are working against speed and clarity.

### 1. Too many navigation models in the `Order` flow

The `Order` tab currently combines:

- top-level analysis tabs
- a section counter (`Section x of 3`)
- previous/next arrows
- inner tabs for `Decision`, `Setup Case`, and `Risk / Invalidation`

This is redundant. Users should not have to infer whether they are stepping through a wizard, browsing tabs, or reviewing a report.

### 2. Too much framing

There are too many nested boxes:

- outer analysis canvas
- section cards
- inner bordered panels
- inner tab containers
- metric cards inside those containers

The repeated borders make the page feel heavier than the content warrants and reduce perceived information density.

### 3. Weak visual hierarchy

The most important items are not anchored strongly enough:

- final trade verdict
- entry / stop / target / R:R
- current risk %
- primary action

Explanations, metrics, warnings, and secondary guidance all compete at similar weight.

### 4. Order execution guidance is overexposed

Broker-specific help is useful, but too much of it is always visible. This pushes form fields down and dilutes focus.

### 5. Fundamentals prioritizes data blocks before conclusions

The fundamentals view leads with metrics and provenance before telling the user what matters. The user should first see:

- overall read
- strengths
- concerns
- data quality

Then detailed metrics and history.

### 6. Intelligence empty state is not diagnostic enough

The current empty state says there are no actionable opportunities, but does not explain:

- what failed
- what to watch next
- what would make the setup actionable

### 7. Utility UI competes with the main task

The bottom notes drawer and floating chat CTA visually compete with the main analysis surface. They should remain available but feel more secondary.

## Design Principles

Use these principles to guide implementation decisions.

1. One navigation model per level.
2. Put decisions before detail.
3. Keep critical trade numbers persistently visible.
4. Reduce container nesting whenever possible.
5. Show advanced guidance progressively, not by default.
6. Use color to signal meaning, not merely to decorate.
7. Preserve current domain logic and payload contracts unless a UI change clearly requires otherwise.

## Target Information Architecture

### Top level

Keep the existing top tabs:

- `Overview`
- `Fundamentals`
- `Intelligence`
- `Order`

These remain the only primary canvas navigation.

### Persistent decision strip

Add a compact, sticky summary strip directly below the top tabs and above tab content.

It should remain visible while scrolling within the canvas.

Recommended contents:

- ticker
- action / verdict
- conviction
- entry
- stop
- target
- R:R
- risk %
- setup type

Desktop behavior:

- horizontal strip, single row where possible

Mobile behavior:

- two-row compressed strip with the most critical items first

This strip should become the user’s stable frame of reference across all tabs.

## Target Layout By Tab

## `Overview`

### Goal

Provide the fastest possible answer to:

- what is the setup
- why it qualifies
- why now
- what invalidates it
- what the user should do next

### Target order

1. Sticky decision strip
2. Summary hero card
3. Chart and compact technical snapshot
4. Optional warning block

### Summary hero card structure

Replace the current large mixed card with a tighter hierarchy:

- Header:
  - `ticker`
  - action badge
  - conviction badge
- Summary sentence:
  - one concise sentence describing combined technical, fundamentals, valuation, and catalyst read
- Pill row:
  - technical
  - fundamentals
  - valuation
  - catalyst
- Key trade plan grid:
  - entry
  - stop
  - target
  - R:R
- Explanation grid:
  - why it qualified
  - why now
  - main risk
  - invalidation
- Coverage/data warnings:
  - separate and visually subordinate to the main thesis

### Change notes

- Compress the valuation section. It currently takes too much vertical space before the higher-level reasoning blocks.
- Move detailed valuation metrics into a collapsible or lower-priority subsection inside `Overview`, or reserve the detailed valuation read for `Fundamentals`.
- Preserve existing explanation content if available; the change is mostly about sequencing and density.

## `Fundamentals`

### Goal

Answer:

- is there a fundamental edge
- what supports it
- what weakens it
- how trustworthy is the dataset

### Target order

1. Sticky decision strip
2. Fundamentals executive summary
3. Data quality and coverage
4. Pillar score cards
5. Key metrics
6. Historical series
7. Raw/source-specific metrics

### Fundamentals executive summary

Create a top summary section before the metric grid.

Recommended structure:

- Overall read:
  - `Positive`, `Mixed`, or `Weak`
- Two strongest supports
- Two main concerns
- One-line trust statement:
  - for example, `Annual-only statement history; quarter-level confidence is limited.`

### Pillar scores

Keep the current pillar card pattern, but tighten it:

- less vertical padding
- consistent card height
- score as large number
- label chip as secondary

### Provenance / metric horizon

The current per-card provenance chips are useful but too repetitive.

Refactor toward:

- one short legend near the top
- lighter inline treatment on each metric card
- tooltip or muted metadata line for source details

Do not remove provenance entirely. Reduce its visual tax.

### Target content grouping

Group detailed metrics into sections:

- profitability
- growth
- balance sheet
- valuation
- coverage / trust

This will scan better than a long undifferentiated grid.

## `Intelligence`

### Goal

Answer:

- is there an actionable intelligence signal
- if not, why not
- what should the user watch next

### Target order

1. Sticky decision strip
2. Intelligence status header
3. Opportunity card or diagnostic empty state
4. Upcoming catalysts
5. Suggested next watch condition

### Empty state redesign

Replace the passive empty state with a diagnostic one.

Recommended structure:

- status line:
  - `No actionable intelligence setup right now`
- why not:
  - threshold or condition that failed
- what to watch:
  - one or two concrete triggers
- last checked:
  - timestamp
- action:
  - `Run again`

If the backend does not yet expose the failed-threshold detail, add a placeholder section and mark it as a follow-up requirement.

## `Order`

### Goal

Guide the user from review to execution with minimal context switching.

### Navigation model

Choose one of these and apply it consistently:

- Option A: tabbed review
- Option B: stepper review

Recommended: `tabbed review` without arrows and without `Section x of 3`.

Reason:

- the content is reference-oriented, not a strict wizard
- users may jump back and forth between decision, setup, and risk

### Target desktop layout

Use a two-column layout:

- left column: order form and editable fields
- right column: compact execution summary and progressive broker help

### Target mobile layout

Single-column order:

1. Sticky decision strip
2. Review tabs
3. Key metrics
4. Form fields
5. Risk summary
6. Broker help accordion
7. Sticky bottom CTA

### Review section content

#### `Decision`

Show:

- recommendation summary
- key reasons
- key numbers

Do not repeat large explanatory blocks already visible in `Overview`.

#### `Setup Case`

Show:

- setup quality
- trend status
- relative strength
- concise explanation of why this setup exists
- three short bullets for qualification

Tighten the current blue explanation panel. It should read like a brief, not a paragraph wall.

#### `Risk / Invalidation`

Split current risk information into three tiers:

- `Hard invalidation`
- `Soft warning`
- `Execution caution`

The current all-red list makes every condition feel equally urgent.

Recommended presentation:

- hard invalidation:
  - red cards
- soft warning:
  - amber cards
- execution caution:
  - one compact note block

### Order form

The form itself is good, but placement can improve.

#### Keep visible near the fields

- order type
- quantity
- entry / trigger price
- stop price
- position summary

#### Demote or collapse by default

- long broker-specific instructions
- verbose execution explanation
- notes if they are auto-filled and not required

The `trade thesis` field can remain visible, but should be clearly optional and lower priority than risk controls.

### Primary action

The primary CTA should feel like the culmination of the page.

Recommended behavior:

- desktop:
  - place `Create Order` inside a sticky bottom bar for the form column, together with:
    - position size
    - risk amount
    - risk %
- mobile:
  - sticky footer CTA with the same compact metrics

This change is high value. It reduces the chance that users scroll away from risk context before submitting.

### Broker guidance

Refactor the current right column into progressive disclosure.

Recommended blocks:

- `How to place this setup`
- `Broker-specific steps`
- `Caution`
- `Exact broker setup`

Default state:

- show only the top summary and one caution
- collapse detailed procedural steps under accordions

This keeps help available without overpowering the form.

## Cross-Cutting UI Changes

### Reduce nested containers

Where possible:

- remove one border level inside the main analysis canvas
- prefer section spacing over extra card wrappers
- use background tone shifts sparingly

### Improve hierarchy of warnings

Not all warnings should look the same.

Use a clearer severity ladder:

- informational: gray / blue
- caution: amber
- block / invalidation: red
- positive confirmation: green

### Make utility surfaces quieter

#### Notes drawer

- keep it docked at bottom
- reduce its visual prominence while collapsed
- ensure it does not read like a competing card

#### Floating chat widget

- keep it available
- slightly reduce default visual dominance on analysis screens if possible
- avoid overlap with sticky order CTA on mobile

## Wireframe Direction

The following is not pixel-perfect. It is a structural target.

### Canvas shell

```text
+---------------------------------------------------------------+
| Overview | Fundamentals | Intelligence | Order                |
+---------------------------------------------------------------+
| Sticky decision strip: RWE.DE | Watch | Medium | Entry | Stop |
+---------------------------------------------------------------+
| Tab-specific content                                           |
|                                                               |
|                                                               |
|                                                               |
+---------------------------------------------------------------+
| Notes drawer                                        Chat      |
+---------------------------------------------------------------+
```

### Order tab desktop

```text
+---------------------------------------------------------------+
| Sticky decision strip                                         |
+---------------------------------------------------------------+
| Decision | Setup Case | Risk / Invalidation                   |
+------------------------------------+--------------------------+
| Order type     Quantity             | How to place this setup  |
| Entry/trigger  Stop                 | Caution                  |
| Position summary                    | Broker steps (collapsed) |
| Notes                               | Exact setup (collapsed)  |
| Trade thesis (optional)             |                          |
|                                    |                          |
| Sticky submit bar: risk amt | % | Create Order                |
+------------------------------------+--------------------------+
```

### Fundamentals tab

```text
+---------------------------------------------------------------+
| Sticky decision strip                                         |
+---------------------------------------------------------------+
| Overall read | Key strengths | Key concerns | Data quality    |
+---------------------------------------------------------------+
| Pillar scores                                                 |
+---------------------------------------------------------------+
| Key metrics grouped by section                                |
+---------------------------------------------------------------+
| History                                                       |
+---------------------------------------------------------------+
| Raw/source-specific details                                   |
+---------------------------------------------------------------+
```

## Component Ownership Map

The following files are likely the primary implementation targets.

### Canvas shell and tab structure

- `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx`
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- `web-ui/src/components/domain/workspace/SymbolNoteWidget.tsx`

### Overview summary

- `web-ui/src/components/domain/workspace/DecisionSummaryCard.tsx`
- `web-ui/src/components/domain/workspace/TechnicalMetricsGrid.tsx`

### Order flow

- `web-ui/src/components/domain/workspace/ActionPanel.tsx`
- `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- `web-ui/src/components/domain/orders/OrderActionPanel.tsx`
- `web-ui/src/components/domain/orders/SetupExecutionGuide.tsx`
- `web-ui/src/components/domain/orders/DegiroOrderConfigGuide.tsx`
- `web-ui/src/components/domain/orders/useOrderRiskMetrics.ts`

### Fundamentals

- `web-ui/src/components/domain/fundamentals/FundamentalsSnapshotCard.tsx`
- `web-ui/src/components/domain/workspace/WorkspaceFundamentalsPanel.tsx`
- `web-ui/src/features/fundamentals/presentation.ts`

### Intelligence

- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- `web-ui/src/components/domain/intelligence/IntelligenceOpportunityCard.tsx`
- `web-ui/src/features/intelligence/hooks.ts`

## Suggested Implementation Sequence

Implement in this order to reduce churn.

### Phase 1: Structural cleanup

- add persistent decision strip
- reduce nested card layers in analysis canvas
- keep current content but reorganize placement

### Phase 2: Order refactor

- remove arrows and `Section x of 3`
- keep only review tabs
- make right-column guidance collapsible
- introduce sticky CTA and compact risk summary

### Phase 3: Overview compression

- compress valuation block
- reorder explanation blocks
- strengthen trade plan hierarchy

### Phase 4: Fundamentals summary-first refactor

- add executive summary block
- group detailed metrics
- reduce provenance noise

### Phase 5: Intelligence diagnostic states

- improve empty state
- add next-watch guidance
- preserve current run action states

## Content and Copy Guidance

Keep copy concise and decision-oriented.

### Prefer

- `Why this qualified`
- `What invalidates it`
- `Watch next`
- `Hard invalidation`
- `Execution caution`

### Avoid

- long paragraph walls where bullets would scan faster
- repeated labeling of the same concept in multiple blocks
- overly technical provenance language in primary surfaces

## Accessibility and Interaction Requirements

The refactor should preserve or improve:

- keyboard access for tabs and accordions
- visible focus states
- tab semantics for actual tabs
- accessible names for sticky actions
- mobile-safe hit targets
- sufficient contrast for severity states

Do not rely on color alone to communicate severity.

## Acceptance Criteria

The implementation is successful when all of the following are true.

1. The `Order` tab uses one clear secondary navigation model only.
2. Entry, stop, target, R:R, and risk % remain easy to find at all times.
3. The primary order action is visible without losing risk context.
4. Broker guidance no longer dominates the editable form area.
5. The `Fundamentals` tab begins with conclusions before raw metrics.
6. Provenance metadata remains available but is visually quieter.
7. The `Intelligence` empty state explains what to watch next.
8. The notes drawer and chat widget feel secondary to the analysis task.
9. The refactor works on both desktop and mobile breakpoints.

## Testing and Validation

Update or add tests around:

- tab behavior in the analysis canvas
- order review tab behavior after navigation simplification
- sticky summary strip rendering
- order CTA enable/disable behavior
- fundamentals summary rendering
- intelligence empty-state rendering

Likely test files to touch:

- `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.test.tsx`
- `web-ui/src/components/domain/workspace/ActionPanel.test.tsx`
- `web-ui/src/components/domain/workspace/DecisionSummaryCard.test.tsx`
- `web-ui/src/components/domain/orders/CandidateOrderModal.test.tsx`
- `web-ui/src/components/domain/fundamentals/FundamentalsSnapshotCard.test.tsx`


## Non-Goals

The following are out of scope unless required by the UI refactor.

- changing backend recommendation logic
- changing screener ranking logic
- changing order creation API contracts
- changing fundamentals data providers
- redesigning the global app shell outside the analysis canvas

## Recommended Handoff To Coding Agent

Use this document as the implementation brief. Start by refactoring structure, not styling details. Preserve existing domain behavior and data bindings where possible. Prioritize:

1. analysis canvas hierarchy
2. order workflow simplification
3. fundamentals summary-first layout
4. intelligence diagnostic empty state

If a backend payload gap blocks the target UX, keep the new structure and add a clear TODO in the component rather than reverting to the old layout.
