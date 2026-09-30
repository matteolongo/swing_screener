# Cockpit review fixes and frontend audit

## Scope

Implement the three findings accepted in the review of PR #481, validate and
merge that PR, then review the frontend for bugs and swallowed errors. Keep
trading rules, backend contracts, signed drafts, and manual execution unchanged.

## Implementation

- [x] Reproduce the missing order ticket, inaccessible unpinned results, and
  stale AI indication with component tests before changing production code.
- [x] Connect queue review actions to the workspace order state. Render the
  existing `ActionPanel` in `ModalShell` from `SymbolDetailPanel`, keyed by
  selection so form values cannot leak between candidates.
- [x] Render `ScreenerCandidatesTable` in the Universes run section from
  `lastResult` and saved display filters. Open the clicked snapshot in
  `UniverseSymbolModal`; never repin an exploration scan implicitly.
- [x] Use `isIntelligenceOutdated` with the displayed analysis and all existing
  fundamentals/price dependencies, preserving explicit regeneration.
- [x] Run the full frontend and backend suites, typecheck, lint, and build;
  inspect UI screenshots and request independent code review.
- [ ] Push the fixes to the existing PR, wait for checks, and merge the verified
  head using the user's explicit merge authorization.
- [ ] Audit the merged frontend by feature and shared infrastructure, tracing
  catches and async failures to their visible error handling. Record concrete
  reproductions, severity, proposed fixes, validation, and review limits in a
  report. Keep any further implementation separate from PR #481.

## Regression checks

`SymbolDetailPanel.test.tsx` asserts that Prepare order renders the real ticket
and that a newer selected daily bar marks cached analysis stale.
`CandidateQueue.test.tsx` checks that Review order preserves the signed draft and
selects order review. `Universes.test.tsx` runs an unpinned scan, opens its result,
and verifies the pinned source is unchanged throughout.

## Validation before push

- Frontend: 153 files, 986 tests pass; typecheck, strict lint, production build pass.
- Backend: 1,867 pass, 7 skip, 8 fail locally. A repeat of the affected test files
  gives the same 7 failures on the original PR head and fixed tree (84 pass).
  Failures concern Windows paths/locking/job scheduling and universe snapshots
  older than the configured age limit; no backend code changed in these fixes.
- Independent review found an absent-analysis stale-badge edge case, now covered
  by a failing-then-passing regression test and fixed.
- Screenshots unavailable: the in-app browser timed out attaching its webview;
  the Chrome browser tool returned `Browser is not available: chrome`.
