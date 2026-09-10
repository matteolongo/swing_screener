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
| `[BE][19]` | Complete; open | PR #464 | Canonical execution-eligibility contract delivered. |
| `[BE][20]` | Complete; open | `codex/stateless-trading-transitions` / [PR #465](https://github.com/matteolongo/swing_screener/pull/465) | Portfolio/stateless regression: 92 passed; frontend full suite: 151 files and 1,000 tests passed; TypeScript typecheck, ESLint, production build, and `git diff --check` passed. The seven broader backend Windows timing/filesystem failures reproduce on the immediate BE-19 base. |
| `[BE][21]` | Complete; open | `codex/canonical-portfolio-analytics` / [PR #466](https://github.com/matteolongo/swing_screener/pull/466) | Canonical persisted/stateless analytics now provide stable ID-less curve identities, self-sufficient journal rows, backend metric statuses, zero-safe insight config, and strategy validation in both modes; 17 focused backend tests, 17 focused frontend tests, full frontend 153 files / 993 tests, typecheck, lint, build, and diff audit passed. |

BE-19 is specified in `docs/superpowers/plans/2026-09-08-canonical-execution-eligibility.md` and is the first implementation target. Subsequent PRs must use the design's acceptance criteria and the boundaries below when their task-level plans are expanded immediately before execution.

## BE-19 contract: canonical execution eligibility

- [ ] Add a pure backend eligibility result with `allowed`, nullable `mode`, and stable blocked `reason`.
- [ ] Normalize `SKIP` to a non-actionable recommendation, prohibit approval claims, and expose no order draft.
- [ ] Return one validated order draft containing order type, entry, stop, target, shares, R:R, quote currency, freshness, and approval identity.
- [ ] Preserve the documented token-gated pending `BUY_LIMIT` pullback exception.
- [ ] Add table-driven core/service tests for workflow, plan coherence, data freshness, same-symbol mode, and approval state.

## BE-20 contract: stateless trading transitions

- [ ] Add request/response envelopes carrying strategy, positions, orders, one command, and the resulting state.
- [ ] Route create, submit, cancel, fill, DeGiro fill, stop update, partial close, final close, and add-on blending through existing execution/portfolio services.
- [ ] Reuse configured heat, concentration, event, fee, FX, and capital policies; remove hardcoded browser policy values.
- [ ] Return linked protective-order changes atomically with the position/order snapshot.
- [ ] Add parity tests proving API-persisted and browser-persisted snapshots produce the same transition result.
- [ ] Document that local mode requires the API for computation but keeps persistence in browser storage.

## BE-21 contract: canonical portfolio analytics

- [ ] Extend portfolio analytics with canonical open heat/risk, effective equity, average R, closed-trade counts, win rate, average R, profit factor, holding period, streaks, equity curve, and tag breakdown.
- [ ] Define breakeven treatment and R units once in backend tests.
- [ ] Source concentration warning thresholds and minimum sample sizes from configuration, not component constants.
- [ ] Reuse the existing strategy validation endpoint for browser-persisted strategy payloads; do not add a second validator.
- [ ] Add deterministic fixtures covering partial closes, per-share initial risk, fees, FX, scratches, and missing values.

## FE-01 contract: consume execution eligibility

- [ ] Map backend eligibility and canonical order draft at the API boundary.
- [ ] Remove `fallbackOrderTypeForSignal`, synthetic `$100` entry, percentage stop, minimum-share fallback, and frontend position-cap sizing.
- [ ] Make ActionPanel, candidate tables, decision strip, and order review render the same backend capability.
- [ ] Retain defensive finite/positive form checks and backend mutation validation; do not create a second policy engine.
- [ ] Preserve null Daily Review plan values through backend and frontend adapters.

## FE-02 contract: preserve reporting selection identity

- [ ] Preserve the existing `lastResult` / immutable `todayRun` separation and its display-filter contract.
- [ ] Add `WorkspaceSelection` with `ticker`, `source`, optional `runId`, optional candidate snapshot, and stable `rowId`.
- [ ] Make Today, Last Run, positions, watchlist, portfolio, and ad-hoc entry points set the correct source.
- [ ] Pass the resolved candidate into AnalysisCanvasPanel, SymbolAnalysisContent, and ActionPanel; remove independent last-result ticker lookup.
- [ ] Store single-symbol compute results in a request-keyed ad-hoc cache without changing `lastResult` or `todayRun`.
- [ ] Invalidate actionable persisted runs on strategy transition.
- [ ] Add divergent-run, tab-switch, ad-hoc-compute, and strategy-transition regression tests.

## FE-03 contract: refresh Daily Review dependencies

- [ ] Add one order-lifecycle invalidation helper covering create, submit, cancel, fill, and DeGiro fill.
- [ ] Always invalidate Daily Review after those transitions; invalidate positions for fill transitions.
- [ ] Split Today loading/error/retry presentation by positions, portfolio review, pinned candidates, and watchlist.
- [ ] Derive empty state and summary counts from the visible composed rows, including pending orders.
- [ ] Deduplicate watchlist rows against visible pinned candidates.
- [ ] Surface trim metadata/action on the canonical open-position row and remove the unused Holding-row path.
- [ ] Add hook and MSW integration tests for cached review invalidation and partial-source rendering.

## FE-04 contract: complete reporting contract transforms

- [ ] Match backend currency validation exactly and preserve valid GBP/CHF/other ISO codes.
- [ ] Keep missing/unknown currency explicit and non-actionable.
- [ ] Preserve the already-landed screener mappings for `quoteCurrency`, `accountCurrency`, quote/account monetary values, rank provenance, and `dataStatus`.
- [ ] Map Daily Review `evaluation_errors` and `summary.evaluation_error_count`, candle `bar_pressure`, remaining reporting provenance, and consumed setup-quality fields.
- [ ] Replace zero-filled nullable Daily Review candidate fields.
- [ ] Replace `validateStrategyLocally()` with `/api/strategy/validate` for both persistence modes.
- [ ] Replace `computeAnalyticsStats`, tag-stat calculations, `PortfolioRiskSummary` calculations, and local portfolio metrics with backend responses.
- [ ] Delete browser execution/portfolio policy from `features/persistence/portfolioService.ts`; retain storage adapters only.
- [ ] Update shared MSW fixtures to complete snake_case backend shapes.
- [ ] Map final/current, intraday/degraded, stale, and missing screener provenance to accurate workspace health.
- [ ] Add complete boundary fixtures and parameterized freshness/currency tests.

## FE-05 contract: repair reporting interactions

- [ ] Replace nested row actions with sibling native buttons in a semantic group.
- [ ] Scope Today keyboard navigation to the list and suspend it in inputs, contenteditable regions, textboxes, and dialogs.
- [ ] Use stable visible-row IDs across filtering, reordering, shrinking, and duplicate tickers.
- [ ] Move remaining reporting copy and assertions to i18n.
- [ ] Remove dead `dailyReviewSelectionKey`, view-model helper, and `patchCandidate` tests after their production surfaces are removed.
- [ ] Merge redundant Today and pending-order tests while retaining distinct behavior coverage.
- [ ] Reconcile the Web UI guide with the pending `BUY_LIMIT` pullback exception.
- [ ] Run accessibility, focused, full frontend, lint, typecheck, build, and coverage checks.

## Stack verification

- [ ] Re-run the focused PR #462 configuration suites before creating the first implementation branch.
- [ ] Verify the first implementation branches descend from `365a3de2` or the merged equivalent, never from the pre-stack `main` snapshot.
- [ ] Verify no heat, concentration, earnings-window, safety-score, R-multiple, order-lifecycle, or portfolio-performance policy remains duplicated in TypeScript.
- [ ] Verify every audit finding maps to one PR and one regression test.
- [ ] Verify each branch uses the branch directly below it as the compare base when stacked.
- [ ] Verify no implementation PR includes planning-only or unrelated working-tree changes.
- [ ] Record exact test commands and results in each PR description.
- [ ] Capture screenshots for PRs 2, 3, and 5 because they change visible Web UI behavior.
