# Frontend Test Suite Audit

Audit of the Vitest suite under `web-ui/src/` (happy-dom + Testing Library + MSW). Goal: cut low-value tests, close real coverage gaps, keep the suite fast. Every finding was verified (read or grepped), not taken from a survey pass. Paths are relative to `web-ui/`.

## 1. Baseline (measured)

- 92 test files, **611 passing**, **8.3s** wall (`npx vitest run`).
- Reported phase breakdown: tests 17.7s, setup 19.4s, env 9.9s, collect 10.5s (cumulative across workers). **Per-file environment init dominates, not test logic.**
- Proof: `src/pages/Universes.test.tsx` has **1 test** and costs **407ms**; `Sidebar.test.tsx` 207ms; `Calendar.test.tsx` (5 tests) 216ms. The fixed per-file cost (happy-dom spin-up + provider/MSW setup) is the tax.
- **Speed lever = fewer files**, not faster assertions. Merging the many 1–3 test files into per-feature files is the only meaningful wall-clock win. Shared helpers exist: `src/test/utils.tsx` (`renderWithProviders`), `src/test/mocks/` (MSW), `src/test/setup.ts`.

## 2. Not useful / trivial tests

Pure type/transform-shape tests — they assert the snake_case→camelCase mapping at runtime, which the TypeScript compiler already guarantees. Verified content (e.g. `src/types/order.test.ts` only does `expect(transformOrder(apiResponse)).toEqual({...})`).

| File | Note |
|------|------|
| `src/types/order.test.ts` | transform-shape only |
| `src/types/position.test.ts` | transform-shape only |
| `src/features/screener/types.test.ts` | field mapping only |
| `src/features/fundamentals/types.test.ts` | field mapping only |
| `src/features/intelligence/types.test.ts` | field mapping only |
| `src/features/intelligence/catalysts/types.test.ts` | field mapping only |
| `src/features/dailyReview/types.test.ts` | mostly field mapping |

These do have *some* value where a transform drops/defaults a field (e.g. `order.ts` injects `feeEur: null`, `broker: null` not present in the API response — that is real logic worth one assertion). **Action:** keep one focused test per transform that asserts the *non-mechanical* parts (defaulted/dropped/renamed-with-logic fields); delete the field-by-field echo cases. Each of these 7 files is also a separate env-init tax (§1) — merging them into the transform's own test cuts file count.

## 3. Deletable tests

- `src/i18n/I18nProvider.test.tsx` — single test asserting locale state; trivially folded into `t.test.ts`. One fewer file.
- `src/lib/api.test.ts` "does not expose removed backend contracts" — documents the *absence* of old fields; types/commits already enforce this. Brittle documentation-as-test. Drop.

## 4. Not effective tests

- **Hardcoded UI strings instead of i18n keys** (violates the repo i18n rule — "source expected text from the same i18n keys the UI uses"). Verified in `src/components/domain/screener/ScreenerForm.test.tsx:66,77,86,101`: `getByText('Broad Market Stocks')`, `getByText('Advanced filters')`, `getByText('USD')`. These break silently on copy changes and don't match the rule. Replace with `t('...')` lookups.
- **Weak DOM queries** — `container.querySelector(...)` instead of role/label queries, in 4 files: `src/components/domain/screener/ScreenerCandidateReviewList.test.tsx`, `src/components/domain/workspace/AnalysisDecisionStrip.test.tsx`, `src/components/domain/portfolio/ConcentrationBar.test.tsx`, `src/components/domain/portfolio/RegimeBreakdownTable.test.tsx`. Brittle to markup changes; prefer `getByRole`/`getByText`.
- **Render-only smoke** — 52 files assert only `toBeInTheDocument()`. Many are fine for presentational components, but the ones wrapping interactive elements (forms, toggles, gates) assert render and never exercise the click/submit. Audit the interactive ones and add a user-event path.

## 5. Redundant tests

- **Isolated hook tests duplicated by page tests.** `src/features/fundamentals/hooks.test.tsx` exercises `useFundamentalSnapshotQuery` + refresh mutation; `src/pages/Fundamentals.test.tsx` re-drives the same behavior through the page. Keep the hook test (faster, focused), thin the page test to integration-only assertions — don't re-test the hook's branches at page level.
- **Store setters tested many ways.** `src/stores/beginnerModeStore.test.ts` asserts toggle/set in ~6 variations; collapse to set + toggle + persistence.

Note: hook-in-isolation + page-integration is a *defensible* split. The redundancy is when both assert the same loading/error branches. Trim the duplicate branch assertions, keep one home for each.

## 6. Tests that must be improved

- **Missing error/loading-state coverage.** Full-page tests assert the happy path with no MSW error handler: `src/pages/Today.test.tsx`, `src/pages/Fundamentals.test.tsx`, `src/features/intelligence/api.test.ts`. Add a failing-handler case asserting the error fallback renders.
- **Missing interaction coverage on forms.** `src/components/domain/orders/FillOrderModalForm.test.tsx`, `UpdateStopModalForm.test.tsx` — add invalid-input cases (e.g. stop price above entry) asserting the validation message.
- **Oversized fixture builders inline.** `src/features/screener/beginnerDecision.test.ts` (~500 lines) rebuilds a 50-field object per test — extract to a shared builder.

## 7. Untested paths / missing tests

**Source files with no test (verified, 38 total).** High-value subset (has logic / holds state):

| File | Why it matters |
|------|----------------|
| `src/stores/screenerStore.ts` | screener selection/persistence state, untested |
| `src/stores/workspaceStore.ts` | workspace selection state, untested |
| `src/hooks/useFormSubmission.ts` | submit/error lifecycle, untested |
| `src/hooks/useModal.ts` | open/close state, untested |
| `src/components/domain/orders/useOrderRiskMetrics.ts` | R-multiple risk math in the UI — should be tested like backend risk |
| `src/components/domain/orders/schemas.ts` | form validation schema — assert reject/accept cases |
| `src/components/common/ErrorBoundary.tsx` | error boundary never triggered in a test |
| `src/components/domain/strategy/StrategySafetyScore.tsx` | derives a safety score — logic, not just markup |

The remaining ~30 are presentational (strategy cards, layout shells, help tooltips, price chart). **Recommendation:** do not chase 100% component coverage — it adds files (env-init tax) for little signal. Prioritize the stateful/logic items above; leave pure presentational components untested or cover them indirectly via their parent page test.

**Untested branches in existing tests:** error/loading on `pages/Today`, `pages/Fundamentals`; empty-list edge in `src/features/screener/prioritization.test.ts`; tie-breaking with identical ranks.

## 8. Slow tests

No single slow test — cost is structural (§1, per-file env init). Largest contributors:

| File | Cost | Note |
|------|-----:|------|
| `src/pages/Universes.test.tsx` | 407ms / 1 test | pure env-init tax — merge into a pages file |
| `src/pages/Calendar.test.tsx` | 216ms | full-page render |
| `src/components/layout/Sidebar.test.tsx` | 207ms | render-only, high fixed cost |
| `src/components/domain/workspace/AnalysisCanvasPanel.test.tsx` | 926-line file | renders the whole workspace with ~20 mocked hooks; split or trim |

**Action:** merge single-test page/component files into per-feature files to amortize env init; split `AnalysisCanvasPanel.test.tsx`. This is where the frontend wall-clock actually moves.

## 9. Prioritized actions

| # | Action | Category | Effort | Payoff |
|---|--------|----------|-------|--------|
| 1 | Fix hardcoded strings → `t()` in `ScreenerForm.test.tsx` (+ audit for others) | not effective | S | i18n-rule compliance, less brittle |
| 2 | Merge single-test page/component files; co-locate type-transform tests with their transform | trivial/redundant | M | fewer files → real wall-clock win |
| 3 | Add tests for `useOrderRiskMetrics.ts`, `orders/schemas.ts`, `screenerStore.ts`, `workspaceStore.ts`, `useFormSubmission.ts`, `useModal.ts` | missing | M | covers UI logic/state |
| 4 | Add error/loading-handler cases to `pages/Today`, `pages/Fundamentals`, `intelligence/api` | improve | M | catches the most common UX bugs |
| 5 | Replace `container.querySelector` with role/label queries in the 4 flagged files | not effective | S | robustness |
| 6 | Thin type-shape tests to non-mechanical assertions; drop `lib/api.test.ts` absence-test | trivial | S | smaller suite |
| 7 | Add `ErrorBoundary` trigger test | missing | S | currently zero coverage of failure UI |

**Honest expectation:** the wall-clock win comes almost entirely from **reducing file count** (action 2), not from faster individual tests. Coverage additions (3, 4, 7) will add files/time but cover the stateful logic and error paths that actually break. Skip chasing the ~30 presentational components.

## 10. Implementation status (this PR)

**Done:**
- Added coverage for the stateful/logic gaps: `useOrderRiskMetrics`, `orders/schemas`, `stores/workspaceStore`, `stores/screenerStore`, `hooks/useModal`, `hooks/useFormSubmission`, and `components/common/ErrorBoundary` (trigger + reset + custom fallback). +7 files, +32 tests.
- Fixed the i18n-rule violation in `ScreenerForm.test.tsx` — `'Advanced filters'` now reads `t('screener.controls.adjustFilters')`. (`'Broad Market Stocks'` and `'USD'` are mock *data* values, not chrome, so they stay literal.)
- Dropped the brittle documentation-as-test "does not expose removed backend contracts" block in `lib/api.test.ts`.

**Investigated and intentionally not changed:**
- *`container.querySelector` queries* (4 files) — they target visual elements (e.g. a concentration bar keyed on `data-warning`) that have **no accessible role or text**. A role/label query isn't available; the data-attribute query is the appropriate tool. Left as-is.
- *Merging single-test files / thinning type-shape tests* — pure churn with regression risk and no coverage gain; the wall-clock saving is real but deferred to a dedicated cleanup rather than mixed into this coverage PR.
- *Page-level error/loading handlers* (`Today`, `Fundamentals`) — deferred; documented as gaps above.

Net effect: 92 → 99 test files, 611 → 643 tests, all green; typecheck and lint clean.
