# Task 7 report

## Status

Complete.

## Implemented

- Added `SymbolIntelligenceTab` as an evidence-first guided workflow.
- Presented the workspace source manifest and enrichment diagnostics before
  generation, including provider, as-of, cache state, item count, and sanitized
  failure details.
- Kept evidence refresh, normal generation, forced regeneration, failed-run
  retry, and optional follow-ups as distinct explicit actions.
- Derived pipeline stages from the active mutation or the symbol-validated saved
  run trace and preserved completed inputs when a later stage fails.
- Labeled current, cached, outdated, and partial results without hiding older
  useful analysis.
- Ordered the result as a discursive recap followed by the existing structured
  intelligence report and evidence, then collapsed advisory follow-ups and
  collapsed history/technical trace.
- Scoped mutation-local results to both normalized ticker and workspace
  `selectionVersion`; late results from another symbol/session are ignored.
- Kept Position Review, Strategic Review, chat, manual execution boundaries, and
  Backtest available.
- Centralized run-trace and ticker-run React Query keys.
- Updated the Web UI guide and localized every new user-facing string.

## TDD evidence

RED:

`cd web-ui && npx vitest run src/components/domain/workspace/SymbolIntelligenceTab.test.tsx`

Exited 1 because `SymbolIntelligenceTab` did not exist. The new tests specified
the input-first manifest, failed pipeline visibility/retry, and outdated-result
preservation before production implementation.

GREEN:

`cd web-ui && npx vitest run src/features/intelligence src/components/domain/workspace/SymbolIntelligenceTab.test.tsx src/components/domain/workspace/PositionReviewPanel.test.tsx src/components/domain/workspace/StrategicReviewPanel.test.tsx src/components/domain/workspace/IntelligenceChatPanel.test.tsx src/components/domain/workspace/NarrativeAnalysisCard.test.tsx src/components/domain/workspace/AnalysisCanvasPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx`

Passed 14 files and 125 tests.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS with zero warnings.
- Focused intelligence/workspace suite — PASS, 125 tests.
- `git diff --check` — PASS.

## Self-review

- Selecting a symbol only fetches the latest saved result; it never calls the
  analysis mutation.
- Evidence refresh does not generate intelligence, and generation does not
  masquerade as a source refresh.
- Forced regeneration is available only when an analysis already exists.
- The active mutation supersedes an older trace while running.
- Trace data is displayed only when its normalized ticker matches the active
  workspace ticker.
- Result callbacks require both the returned normalized symbol and captured
  selection session to match the current workspace.
- Optional review/chat actions remain collapsed, explicit, advisory, and do not
  mutate positions or orders.
- Backtest routing and rendering are unchanged.

## Concerns

None.
