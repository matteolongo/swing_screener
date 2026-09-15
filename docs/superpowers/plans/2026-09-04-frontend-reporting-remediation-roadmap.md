# Frontend Reporting Remediation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the reporting remediation as three backend ownership PRs and five frontend consumption/interaction PRs on top of backend PR #462.

**Architecture:** The stack first centralizes execution eligibility, browser-persisted trading transitions, and portfolio analytics in canonical backend modules. Frontend PRs then remove duplicated domain policy, repair selection/run identity and Daily Review composition, align contracts, and finish accessibility/test cleanup. Each PR leaves the repository in a working, independently reviewable state.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, React 18, TypeScript, Zustand, TanStack React Query, Vitest, React Testing Library, MSW, repository i18n.

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-reporting-remediation-design.md`

**Verified baseline:** `codex/remove-dead-report-config-paths` at `365a3de2` (`[BE][18] Consolidate report configuration ownership`). Until the backend stack merges, each independent bottom PR targets that branch; after merge, retarget it to `main` without changing its content.

## Global Constraints

- Preserve deterministic end-of-day screening and manual execution.
- Keep `recommendation.workflowStatus` and `recommendation.nextStep` server-authoritative.
- Never use `decisionSummary.action` to authorize an order.
- Never coerce missing plan values or unknown currencies into plausible trading values.
- Keep Today's pinned run separate from exploratory and ad-hoc analysis.
- Preserve backend `priorityRank` and `rank`.
- Transform snake_case to camelCase only at API boundaries.
- Route all user-facing copy through `web-ui/src/i18n/`.
- Keep backend and frontend contract changes in the same PR.
- Update the nearest documentation and `CHANGELOG.md` when user-visible behavior changes.
- Treat `VITE_PERSISTENCE_MODE=local` as browser-owned storage with backend-owned computation; fully offline trading mutations are out of scope.
- Keep only input-shape validation, formatting, chart layout, and explicitly provisional form feedback in the frontend.

---

## Merge order

| PR | Branch | Base | Outcome | Depends on |
|---|---|---|---|---|
| `[BE][19] Expose canonical execution eligibility` | `codex/canonical-execution-eligibility` | PR #462 head, then `main` after merge | Candidate capability and order draft are backend-authoritative; `SKIP` is impossible to approve | Backend stack |
| `[BE][20] Centralize stateless trading transitions` | `codex/stateless-trading-transitions` | BE-19 | Browser-persisted orders/positions use canonical backend commands | BE-19 |
| `[BE][21] Serve canonical portfolio analytics` | `codex/canonical-portfolio-analytics` | BE-20 | Portfolio/edge metrics and strategy safety have one backend authority | BE-20 |
| `[FE][01] Consume fail-closed execution contracts` | `codex/consume-execution-eligibility` | BE-21 | UI renders backend eligibility/draft and removes fabricated plans | BE-19, BE-20, BE-21 |
| `[FE][02] Preserve reporting selection identity` | `codex/preserve-reporting-run-identity` | FE-01 | Workspace selection retains source/run/candidate identity; ad-hoc analysis is separate | FE-01 |
| `[FE][03] Refresh Daily Review dependencies` | `codex/refresh-daily-review-state` | FE-02 | Order mutations refresh Daily Review; Today renders independent source states | FE-02 |
| `[FE][04] Complete reporting contract transforms` | `codex/align-reporting-contracts` | FE-03 + BE-21 | UI consumes backend analytics/validation and maps remaining contracts | FE-03, BE-21 |
| `[FE][05] Repair reporting interactions` | `codex/repair-reporting-interactions` | FE-04 | Semantic row actions, scoped keyboard navigation, i18n, test cleanup, docs | FE-04 |

## Execution status

| Work item | Status | Branch / PR | Verification |
|---|---|---|---|
| `[BE][19]` | Complete; merged | [PR #464](https://github.com/matteolongo/swing_screener/pull/464) + recovery [#474](https://github.com/matteolongo/swing_screener/pull/474) | Canonical execution-eligibility contract delivered; inherited eligibility commits recovered with 104 backend and 8 frontend focused tests before merge. |
| `[BE][20]` | Complete; merged | `codex/stateless-trading-transitions` / [PR #465](https://github.com/matteolongo/swing_screener/pull/465) | Portfolio/stateless regression: 92 passed; frontend full suite: 151 files and 1,000 tests passed; TypeScript typecheck, ESLint, production build, and `git diff --check` passed. The seven broader backend Windows timing/filesystem failures reproduce on the immediate BE-19 base. |
| `[BE][21]` | Complete; merged | `codex/canonical-portfolio-analytics` / [PR #466](https://github.com/matteolongo/swing_screener/pull/466) | Canonical persisted/stateless analytics now provide stable ID-less curve identities, self-sufficient journal rows, backend metric statuses, zero-safe insight config, and strategy validation in both modes; 17 focused backend tests, 17 focused frontend tests, full frontend 153 files / 993 tests, typecheck, lint, build, and diff audit passed. |
| `[FE][01]` | Complete; [#467](https://github.com/matteolongo/swing_screener/pull/467) | `codex/consume-execution-eligibility` | Frontend transforms and validates the fail-closed backend capability/draft; unsigned or malformed drafts, signal fallbacks, fabricated plans, and browser position-cap policy are removed. Focused tests: 90 passed; lint/build/diff-check passed. Baseline typecheck and MSW/happy-dom runner failures are documented in the PR. |
| `[FE][02]` | Complete; [#468](https://github.com/matteolongo/swing_screener/pull/468) | `codex/preserve-reporting-run-identity` | Source-aware workspace selections preserve pinned/last-run candidate identity, ad-hoc analysis remains local, and strategy activation invalidates actionable persisted runs. Focused assertions: 84 passed; lint/build/diff-check passed. Baseline typecheck and MSW/happy-dom runner failures are documented in the PR. |
| `[FE][03]` | Complete; [#470](https://github.com/matteolongo/swing_screener/pull/470) | `codex/refresh-daily-review-state` | Order lifecycle transitions invalidate Daily Review (and positions after fills); Today composes independently loaded positions, backend-filtered watchlist near-trigger rows, pinned candidates, and portfolio review state. Local reviews submit the browser watchlist and strategy to stateless compute; API reviews use persisted state. Focused assertions: 37 backend and 23 frontend passed; affected Ruff/ESLint, Vite production bundle, and diff-check passed. This worktree's cross-worktree dependency junction (`msw@2.15.0` with `happy-dom@12.10.3`) still blocks both unshimmed MSW integration tests and typecheck with errors outside the FE-03 diff; clean-install CI is authoritative. |
| `[FE][04]` | Complete; [#472](https://github.com/matteolongo/swing_screener/pull/472) | `codex/align-reporting-contracts` | Registered currencies and explicit unknown values are fail-closed at reporting boundaries; Daily Review errors, candle pressure, provenance, and setup-quality fields are preserved. Strategy validation and persisted/local portfolio analytics consume canonical backend responses. Focused backend: 40 passed. Focused frontend boundary/workspace tests: 56 passed; the linked cross-worktree MSW/happy-dom mismatch still blocks MSW-backed tests and leaves four pre-existing type errors outside this diff. |
| `[FE][05]` | Complete; [#473](https://github.com/matteolongo/swing_screener/pull/473) | `codex/repair-reporting-interactions` | Semantic sibling row actions, list-scoped stable keyboard navigation, reporting i18n, and dead test/state cleanup delivered. Focused non-network tests: 32 passed; full ESLint and the Vite production bundle passed. The linked cross-worktree dependency junction (`msw@2.15.0` with `happy-dom@12.10.3`) blocks MSW-backed Today, full-suite, and coverage runs with unhandled `defaultPrevented` errors. Typecheck and the combined production build retain four dependency/type errors outside this diff. A UI screenshot could not be captured because the same broken dependency junction prevents the Today page data layer from rendering a representative state locally. |

BE-19 is specified in `docs/superpowers/plans/2026-09-08-canonical-execution-eligibility.md` and is the first implementation target. Subsequent PRs must use the design's acceptance criteria and the boundaries below when their task-level plans are expanded immediately before execution.

## BE-19 contract: canonical execution eligibility

- [x] Add a pure backend eligibility result with `allowed`, nullable `mode`, and stable blocked `reason`.
- [x] Normalize `SKIP` to a non-actionable recommendation, prohibit approval claims, and expose no order draft.
- [x] Return one validated order draft containing order type, entry, stop, target, shares, R:R, quote currency, freshness, and approval identity.
- [x] Preserve the documented token-gated pending `BUY_LIMIT` pullback exception.
- [x] Add table-driven core/service tests for workflow, plan coherence, data freshness, same-symbol mode, and approval state.

## BE-20 contract: stateless trading transitions

- [x] Add request/response envelopes carrying strategy, positions, orders, one command, and the resulting state.
- [x] Route create, submit, cancel, fill, DeGiro fill, stop update, partial close, final close, and add-on blending through existing execution/portfolio services.
- [x] Reuse configured heat, concentration, event, fee, FX, and capital policies; remove hardcoded browser policy values.
- [x] Return linked protective-order changes atomically with the position/order snapshot.
- [x] Add parity tests proving API-persisted and browser-persisted snapshots produce the same transition result.
- [x] Document that local mode requires the API for computation but keeps persistence in browser storage.

## BE-21 contract: canonical portfolio analytics

- [x] Extend portfolio analytics with canonical open heat/risk, effective equity, average R, closed-trade counts, win rate, average R, profit factor, holding period, streaks, equity curve, and tag breakdown.
- [x] Define breakeven treatment and R units once in backend tests.
- [x] Source concentration warning thresholds and minimum sample sizes from configuration, not component constants.
- [x] Reuse the existing strategy validation endpoint for browser-persisted strategy payloads; do not add a second validator.
- [x] Add deterministic fixtures covering partial closes, per-share initial risk, fees, FX, scratches, and missing values.

## FE-01 contract: consume execution eligibility

- [ ] Map backend eligibility and canonical order draft at the API boundary.
- [ ] Remove `fallbackOrderTypeForSignal`, synthetic `$100` entry, percentage stop, minimum-share fallback, and frontend position-cap sizing.
- [ ] Make ActionPanel, candidate tables, decision strip, and order review render the same backend capability.
- [ ] Retain defensive finite/positive form checks and backend mutation validation; do not create a second policy engine.
- [ ] Preserve null Daily Review plan values through backend and frontend adapters.

## FE-02 contract: preserve reporting selection identity

- [x] Preserve the existing `lastResult` / immutable `todayRun` separation and its display-filter contract.
- [x] Add `WorkspaceSelection` with `ticker`, `source`, optional `runId`, optional candidate snapshot, and stable `rowId`.
- [x] Make Today, Last Run, positions, watchlist, portfolio, and ad-hoc entry points set the correct source.
- [x] Pass the resolved candidate into AnalysisCanvasPanel, SymbolAnalysisContent, and ActionPanel; remove independent last-result ticker lookup.
- [x] Store single-symbol compute results in a request-keyed ad-hoc cache without changing `lastResult` or `todayRun`.
- [x] Invalidate actionable persisted runs on strategy transition.
- [x] Add divergent-run, tab-switch, ad-hoc-compute, and strategy-transition regression tests.

## FE-03 contract: refresh Daily Review dependencies

- [x] Add one order-lifecycle invalidation helper covering create, submit, cancel, fill, and DeGiro fill.
- [x] Always invalidate Daily Review after those transitions; invalidate positions for fill transitions.
- [x] Split Today loading/error/retry presentation by positions, portfolio review, pinned candidates, and watchlist.
- [x] Derive empty state and summary counts from the visible composed rows, including pending orders.
- [x] Deduplicate backend-filtered watchlist near-trigger rows against visible pinned candidates.
- [x] Enrich the browser watchlist with its supplied strategy in stateless Daily Review, without reading persisted watchlist state or duplicating the backend threshold.
- [x] Surface trim metadata/action on the canonical open-position row and remove the unused Holding-row path.
- [x] Add hook and MSW integration tests for cached review invalidation and partial-source rendering.

## FE-04 contract: complete reporting contract transforms

- [x] Match backend currency validation exactly and preserve valid GBP/CHF/other ISO codes.
- [x] Keep missing/unknown currency explicit and non-actionable.
- [x] Preserve the already-landed screener mappings for `quoteCurrency`, `accountCurrency`, quote/account monetary values, rank provenance, and `dataStatus`.
- [x] Map Daily Review `evaluation_errors` and `summary.evaluation_error_count`, candle `bar_pressure`, remaining reporting provenance, and consumed setup-quality fields.
- [x] Replace zero-filled nullable Daily Review candidate fields.
- [x] Replace `validateStrategyLocally()` with `/api/strategy/validate` for both persistence modes.
- [x] Replace `computeAnalyticsStats`, tag-stat calculations, `PortfolioRiskSummary` calculations, and local portfolio metrics with backend responses.
- [x] Delete browser execution/portfolio policy from `features/persistence/portfolioService.ts`; retain storage adapters only.
- [x] Update shared MSW fixtures to complete snake_case backend shapes.
- [x] Map final/current, intraday/degraded, stale, and missing screener provenance to accurate workspace health.
- [x] Add complete boundary fixtures and parameterized freshness/currency tests.

## FE-05 contract: repair reporting interactions

- [x] Replace nested row actions with sibling native buttons in a semantic group.
- [x] Scope Today keyboard navigation to the list and suspend it in inputs, contenteditable regions, textboxes, and dialogs.
- [x] Use stable visible-row IDs across filtering, reordering, shrinking, and duplicate tickers.
- [x] Move remaining reporting copy and assertions to i18n.
- [x] Remove dead `dailyReviewSelectionKey`, view-model helper, and `patchCandidate` tests after their production surfaces are removed.
- [x] Merge redundant Today and pending-order tests while retaining distinct behavior coverage.
- [x] Reconcile the Web UI guide with the pending `BUY_LIMIT` pullback exception.
- [x] Run accessibility, focused, full frontend, lint, typecheck, build, and coverage checks.

## Stack verification

- [x] Re-run the focused PR #462 configuration suites before creating the first implementation branch.
- [x] Verify the first implementation branches descend from `365a3de2` or the merged equivalent, never from the pre-stack `main` snapshot.
- [x] Verify no heat, concentration, earnings-window, safety-score, R-multiple, order-lifecycle, or portfolio-performance policy remains duplicated in TypeScript.
- [x] Verify every audit finding maps to one PR and one regression test.
- [x] Verify each branch uses the branch directly below it as the compare base when stacked; merge-time retargets to `main` preserved dependency order.
- [x] Verify no implementation PR includes planning-only or unrelated working-tree changes.
- [x] Record exact test commands and results in each PR description.
- [x] Record the exact environment limitation in PRs #468, #470, and #473 where the linked dependency tree prevented representative screenshots.

Final audit (2026-09-15): PRs #457–#468, #470, #472–#474 merged in dependency order. Clean-install GitHub checks passed on the corrected stack tips; final focused recovery checks passed (104 backend, 8 frontend), the production bundle completed with 1,935 modules, and every stacked comparison passed `git diff --check` before merge.
