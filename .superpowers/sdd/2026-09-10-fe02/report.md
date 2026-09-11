# FE-02 implementation report

## TDD evidence

- RED: added the divergent same-ticker/run identity regression to
  `workspaceStore.test.ts`; it failed because `setWorkspaceSelection` did not
  exist.
- GREEN: introduced the source-aware selection envelope and verified the store
  test suite (12 tests).
- RED: added strategy-transition invalidation coverage to `screenerStore.test.ts`;
  it failed because `invalidateActionableRuns` did not exist.
- GREEN: persisted actionable Last Run/Today snapshots are cleared after a
  successful strategy activation; screener, workspace, and strategy focused
  suites passed (22 tests). ActionPanel contract tests also passed (25 tests).
- RED (review remediation): revisiting the same held ticker through a new
  workspace selection session called the auto-compute mutation once rather
  than twice, because the guard was keyed only by ticker.
- GREEN: key the auto-compute guard by the existing request/cache session
  (`ticker:selectionVersion`). Canvas regressions now cover that revisit,
  a divergent pinned run across tab switches, and an ad-hoc response that
  must not replace Last Run.

## Verification

- Focused: `vitest run src/stores/screenerStore.test.ts src/stores/workspaceStore.test.ts src/features/strategy/hooks.test.tsx src/components/domain/workspace/ActionPanel.test.tsx` — 47 passed.
- Review-focused Canvas: `vitest run src/components/domain/workspace/AnalysisCanvasPanel.test.tsx` — 37 assertions passed. The runner also reports the known MSW 2/happy-dom unhandled event error.
- Content: `vitest run src/components/domain/workspace/SymbolAnalysisContent.test.tsx` — 8 assertions passed; the pre-existing Volume Zones MSW integration assertion cannot receive its mock response because the same MSW 2/happy-dom event error converts it to a request failure. No FE-02 assertion failed.
- Lint: `eslint .` — passed.
- Production build: `vite build` — passed.
- Typecheck: existing baseline failures remain in `src/hooks/useModal.ts` (Node
  `Timeout` vs DOM `number`) and `src/test/setup.ts` (MSW `SetupServerApi`
  incompatibility/nullability); FE-02 introduced no TypeScript errors.
- Full frontend suite was attempted. It remains blocked by the pre-existing
  MSW 2/happy-dom event incompatibility (`Cannot set property defaultPrevented
  of #<TypedEvent> which has only a getter`), which cascades into mocked
  portfolio-service failures. Existing canvas tests that seed only legacy
  ticker state are now obsolete under the source-aware selection contract.
- `git diff --check` — passed.

## Screenshot

No screenshot was captured: the workspace could build but a meaningful rendered
Today flow requires the local API, and the frontend test runtime's MSW/happy-dom
event incompatibility prevents a reliable mocked rendering flow in this
environment.

## Commit

`Preserve reporting run identity` (single root-cause commit; SHA recorded in delivery)
