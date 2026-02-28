# UI/UX Improvement Plan for Education (Grounded)

This plan is aligned to the current Workspace-first app architecture and existing implementation state.

## Phase 1: Foundational Knowledge (Tooltips & Glossary)

*   **Status:** [~] In Progress
*   **Goal:** Eliminate confusion from jargon and create a central knowledge base.
*   **Current Reality:**
    *   Reusable tooltip component exists and is used across strategy and education surfaces.
    *   Glossary model and metric help labels exist and are used in Screener and Daily Review.
*   **Remaining Actions:**
    *   [ ] Add dedicated `/learn` page that aggregates glossary entries.
    *   [ ] Add direct links from in-context glossary/metric surfaces to the Learn page.

## Phase 2: Visual Learning (Indicator Previews)

*   **Status:** [ ] To Do
*   **Goal:** Help users visually understand what indicators do, not just read about them.
*   **Current Reality:**
    *   Lightweight chart rendering exists for cached symbol history.
    *   Strategy page has rich educational help, but no indicator preview card yet.
*   **Actions:**
    *   [ ] Add a deterministic, client-side `IndicatorPreviewCard` on Strategy.
    *   [ ] Reuse SVG charting approach (no new chart dependency).
    *   [ ] Visualize SMA windows, breakout lookback channel, and pullback MA.
    *   [ ] Debounce updates (120ms) to keep interactions responsive.

## Phase 3: Contextual Analysis (The "Why" Feature)

*   **Status:** [~] Partially Done
*   **Goal:** Explain in plain English *why* a stock matched criteria.
*   **Current Reality:**
    *   Structured thesis and "why qualified" rendering already exist.
    *   Screener rows already have expandable detail actions.
*   **Remaining Actions:**
    *   [ ] Add explicit "Why this matched" action in **Workspace > Screener Inbox** row actions.
    *   [ ] Route action to Workspace analysis order/thesis context.
    *   [ ] Add fallback rationale rendering when thesis is missing (from recommendation reasons).

## Notes

*   Workspace is the canonical screener UX. The legacy standalone screener route redirects to Workspace.
*   No backend API changes are required for these phases.
