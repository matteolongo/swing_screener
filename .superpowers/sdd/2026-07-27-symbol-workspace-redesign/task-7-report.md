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

## Review fix round 1

Implemented:

- Associated a settled mutation with the newest same-symbol ticker run whose
  `startedAt` is at or after the captured request start, then fetched that exact
  trace. A new failure no longer appears beside the prior successful trace, and
  failed first attempts can show their own provenance.
- Preserved the failed request mode for retry: normal retries remain normal and
  force retries remain forced.
- Kept Position Review and Strategic Review available in collapsed follow-ups
  before a narrative exists; chat remains gated on analysis context.
- Treated a step trace with `running` status as running; only `ok` is complete.
- Left the evidence-refresh action unchanged pending the controller's API
  decision.

RED evidence:

- `npx vitest run src/components/domain/workspace/SymbolIntelligenceTab.test.tsx`
  failed 3 tests: normal retry forced regeneration, pre-analysis follow-ups were
  absent, and an in-flight format step rendered complete.
- `npx vitest run src/features/intelligence/__tests__/traceHooks.test.tsx`
  failed because `findRunStartedAfter` did not exist.

GREEN verification:

- `npx vitest run src/features/intelligence src/components/domain/workspace/SymbolIntelligenceTab.test.tsx src/components/domain/workspace/PositionReviewPanel.test.tsx src/components/domain/workspace/StrategicReviewPanel.test.tsx src/components/domain/workspace/IntelligenceChatPanel.test.tsx src/components/domain/workspace/NarrativeAnalysisCard.test.tsx src/components/domain/workspace/AnalysisCanvasPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx`
  — PASS, 14 files and 130 tests.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS with zero warnings.
- `git diff --check` — PASS.

Concerns: evidence refresh still has no dedicated backend endpoint; intentionally
unchanged while the controller resolves the approved-plan/API conflict.

## Evidence refresh endpoint follow-up

Implemented after user approval:

- Added `POST /api/intelligence/{ticker}/evidence/refresh`.
- The endpoint validates and normalizes the ticker, forces only configured
  evidence collectors, updates the normal curated evidence cache, and returns a
  sanitized per-provider manifest with overall `fresh`/`partial`/`failed`
  status. It does not require or invoke the analyzer/LLM and has no
  position/order/trading-state dependencies.
- Added collector attempt reporting without copying exception text into the
  response. Failed entries expose only `Evidence provider failed.`.
- Added frontend API/domain transforms and a dedicated React Query mutation/cache
  key, separate from generation.
- Wired **Refresh evidence sources** to the new endpoint. Successful manifests
  replace the aggregate evidence row; request and provider failures remain
  visible in the input table.
- Guarded refreshed manifest display with normalized ticker and workspace
  `selectionVersion`; switching sessions resets mutation-local evidence state.
- Updated API, intelligence-module, and Web UI documentation.

RED evidence:

- `uv run pytest tests/test_intelligence_evidence_refresh.py tests/test_evidence_collect.py -q`
  failed 3 tests: the endpoint returned 404 and `collect_evidence` rejected the
  attempt callback.
- `npx vitest run src/features/intelligence/api.test.ts src/components/domain/workspace/SymbolIntelligenceTab.test.tsx`
  failed because `refreshIntelligenceEvidence` did not exist and refreshed
  provider rows were absent.
- The focused manifest failure test failed because a failed request left the
  prior aggregate evidence row looking fresh.

GREEN verification:

- Backend focused tests: 26 passed across evidence collection, the refresh
  endpoint, enrichment, and router enrichment.
- Ruff: all checks passed for changed backend/test files.
- Frontend focused suite: 14 files and 133 tests passed.
- TypeScript typecheck: passed.
- ESLint strict: passed with zero warnings.
- `git diff --check`: passed.

Concerns: none.

## Review fix round 2

- Replaced timestamp correlation with a stable client attempt ID persisted in
  `RunTrace` and `RunIndexEntry`, together with the normal/force attempt mode.
- Selected the exact attempt after settlement, including errors and concurrent
  same-ticker requests. After remount, the newest persisted run supersedes an
  older cached success; retry restores the persisted force mode.
- Kept old run files compatible through optional trace/index fields.
- Made refreshed provider evidence rows independent from aggregate evidence
  diagnostics, and represented an empty failed refresh as an aggregate failure.
- Restricted refresh-source `source` to the literal `"evidence"`.

RED evidence:

- Trace persistence rejected the new attempt fields.
- The frontend analysis request omitted `attempt_id`, and exact attempt lookup
  did not exist.
- Refreshed provider rows inherited stale aggregate counts/messages, while an
  empty failed refresh retained the old fresh aggregate row.

GREEN verification:

- `pytest tests/intelligence/test_tracing.py -q` — 14 passed.
- Focused frontend API, trace-hook, manifest, and workspace suite — 61 passed.

Full-suite audit:

- `test_sweep_returns_analyzed_and_failed` failed because a `MagicMock`
  fundamentals `asof_date` violated the new diagnostic string contract.
- `test_analyze_position_returns_cache_without_calling_analyzer` returned 500
  through the same unsanitized provider-metadata path.
- Both parametrizations of `test_analyze_output_is_stable` differed because an
  empty `enrichment_diagnostics` list was added to otherwise unchanged analyzer
  output.
- These were Task 6/7 contract regressions, not baseline failures. Provider
  metadata is now accepted only when it is a real string, and the graph emits
  `enrichment_diagnostics` only when entries exist. The exact four failing tests
  now pass.

Final verification:

- Full frontend suite — 149 files, 800 tests passed.
- Impacted backend/API/intelligence suite — 20 passed.
- TypeScript typecheck — passed.
- ESLint strict — passed with zero warnings.
- Ruff on every changed backend/test module — passed.
- `git diff --check` — passed.
- A full backend run reached 1,546 passed and 7 skipped before reporting the
  four regressions above; all four were then fixed and rerun successfully.

## Review fix round 3

- A failed live mutation now resolves only its exact persisted attempt. Client
  payload preflight failures and server prerequisite failures that occur before
  tracing show a standalone error instead of an older successful trace.
- Reload selection deterministically prefers the newest attempt-aware run, then
  the cached result run, and uses legacy newest history only when no cached run
  exists.

TDD evidence:

- RED: three resolver regressions failed: client preflight and untraced 503 both
  returned `old-success`, while remount selected `newer-legacy` instead of
  `modern-attempt`.
- GREEN: focused trace/workspace suite — 43 passed.
- TypeScript typecheck — passed.
- ESLint strict — passed with zero warnings.
