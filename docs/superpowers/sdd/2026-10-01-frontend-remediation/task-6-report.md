# Task 6 review: dates, locale, token guardrails, and documentation

## Scope

Task 6 closes the remaining calendar, weekly-review, styling-policy, and documentation findings from the frontend audit.

## Changes reviewed

- Computes `YYYY-Www` with the ISO week-year, including the year-boundary case.
- Formats Calendar dates using the active `I18nProvider` locale and renders every `EventSourceTag`, including IPO events.
- Extends the semantic-token ESLint guard to directional border color utilities and applies semantic hover, tooltip, and fallback copy in the touched components.
- Moves touched Universe screener copy to i18n keys.
- Documents the UI contracts and remediation plan in the web UI guides and overview index.

## Verification

- Focused remediation tests passed: 8 files, 40 tests.
- Full frontend suite passed: 156 files, 1,016 tests.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- A temporary `border-t-gray-900` fixture was rejected by the configured ESLint rule, then removed.
- The full-suite run exposed a timing-only assertion in `HelpTooltip.test.tsx`: `ModalShell` restores focus during passive-effect cleanup. The analogous chart test already waits for that observable state. The tooltip test now waits for both dialog removal and trigger-focus restoration; no production behavior change was needed.
- `uv run --extra dev pytest -q` could not complete on this Windows runner. After redirecting pytest's inaccessible system temp directory into the worktree, `tests/api/test_backtest_run_manager.py::test_completed_job_carries_result` still timed out (`1 failed, 55 passed` with `-x`). The manager reads its persisted job snapshot before its in-memory state while a worker replaces that snapshot; this Windows-specific file-update interaction needs a backend follow-up. The frontend change set does not touch that thread-backed backend job runner.
- An independent reviewer dispatch was unavailable because the connected account had reached its usage limit; the controller completed the manual review.

## Review result

PASS for the frontend remediation scope. The outstanding backend verification limitation is platform-specific and outside the changed paths.
