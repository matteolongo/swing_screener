# Frontend Reporting Remediation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the frontend reporting remediation as five reviewable pull requests in dependency order.

**Architecture:** The stack first makes execution fail closed, then fixes selection/run identity, then repairs Daily Review composition and invalidation, aligns API contracts and freshness, and finally consolidates accessibility and test hygiene. Each PR leaves the repository in a working, independently reviewable state.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, React 18, TypeScript, Zustand, TanStack React Query, Vitest, React Testing Library, MSW, repository i18n.

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-reporting-remediation-design.md`

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

---

## Merge order

| PR | Branch | Base | Outcome | Depends on |
|---|---|---|---|---|
| 1 | `codex/fail-closed-order-eligibility` | `main` after this planning PR merges | `SKIP` and invalid plans cannot enter order review | Planning PR |
| 2 | `codex/preserve-reporting-run-identity` | `main` | Workspace selection retains source/run/candidate identity; ad-hoc analysis is separate | Planning PR |
| 3 | `codex/refresh-daily-review-state` | PR 2 branch | Order mutations refresh Daily Review; Today renders independent source states | PR 2 |
| 4 | `codex/align-reporting-contracts` | `main` | Currency, missing values, backend additions, mocks, and freshness agree | PR 1 for eligibility types |
| 5 | `codex/repair-reporting-interactions` | PR 3 branch | Semantic row actions, scoped keyboard navigation, i18n, test cleanup, docs | PRs 2 and 3; rebase after PR 4 |

PR 1 is specified in `docs/superpowers/plans/2026-09-04-fail-closed-order-eligibility.md` and is the first implementation target. Subsequent PRs must use the design's acceptance criteria and the boundaries below when their task-level plans are expanded immediately before execution.

## PR 2 contract: preserve reporting run identity

- [ ] Add `WorkspaceSelection` with `ticker`, `source`, optional `runId`, optional candidate snapshot, and stable `rowId`.
- [ ] Make Today, Last Run, positions, watchlist, portfolio, and ad-hoc entry points set the correct source.
- [ ] Pass the resolved candidate into AnalysisCanvasPanel, SymbolAnalysisContent, and ActionPanel; remove independent last-result ticker lookup.
- [ ] Store single-symbol compute results in a request-keyed ad-hoc cache without changing `lastResult` or `todayRun`.
- [ ] Invalidate actionable persisted runs on strategy transition.
- [ ] Add divergent-run, tab-switch, ad-hoc-compute, and strategy-transition regression tests.

## PR 3 contract: refresh and compose Daily Review

- [ ] Add one order-lifecycle invalidation helper covering create, submit, cancel, fill, and DeGiro fill.
- [ ] Always invalidate Daily Review after those transitions; invalidate positions for fill transitions.
- [ ] Split Today loading/error/retry presentation by positions, portfolio review, pinned candidates, and watchlist.
- [ ] Derive empty state and summary counts from the visible composed rows, including pending orders.
- [ ] Deduplicate watchlist rows against visible pinned candidates.
- [ ] Surface trim metadata/action on the canonical open-position row and remove the unused Holding-row path.
- [ ] Add hook and MSW integration tests for cached review invalidation and partial-source rendering.

## PR 4 contract: align reporting contracts and freshness

- [ ] Match backend currency validation exactly and preserve valid GBP/CHF/other ISO codes.
- [ ] Keep missing/unknown currency explicit and non-actionable.
- [ ] Map candle `bar_pressure`, reporting provenance, quote/account currency, quote risk, and consumed setup-quality fields.
- [ ] Replace zero-filled nullable Daily Review candidate fields.
- [ ] Update shared MSW fixtures to complete snake_case backend shapes.
- [ ] Map final/current, intraday/degraded, stale, and missing screener provenance to accurate workspace health.
- [ ] Add complete boundary fixtures and parameterized freshness/currency tests.

## PR 5 contract: repair interactions and test hygiene

- [ ] Replace nested row actions with sibling native buttons in a semantic group.
- [ ] Scope Today keyboard navigation to the list and suspend it in inputs, contenteditable regions, textboxes, and dialogs.
- [ ] Use stable visible-row IDs across filtering, reordering, shrinking, and duplicate tickers.
- [ ] Move remaining reporting copy and assertions to i18n.
- [ ] Remove dead `dailyReviewSelectionKey`, view-model helper, and `patchCandidate` tests after their production surfaces are removed.
- [ ] Merge redundant Today and pending-order tests while retaining distinct behavior coverage.
- [ ] Reconcile the Web UI guide with the pending `BUY_LIMIT` pullback exception.
- [ ] Run accessibility, focused, full frontend, lint, typecheck, build, and coverage checks.

## Stack verification

- [ ] Verify every audit finding maps to one PR and one regression test.
- [ ] Verify each branch uses the branch directly below it as the compare base when stacked.
- [ ] Verify no implementation PR includes planning-only or unrelated working-tree changes.
- [ ] Record exact test commands and results in each PR description.
- [ ] Capture screenshots for PRs 2, 3, and 5 because they change visible Web UI behavior.
