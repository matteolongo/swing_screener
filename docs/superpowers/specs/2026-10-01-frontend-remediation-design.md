# Frontend remediation design — 2026-10-01

## Goal

Correct the user-visible reliability, recovery, accessibility, and consistency
defects recorded in the 2026-10-01 frontend audit, without changing trading
rules, backend contracts, or the application's manual-execution boundary.

## Scope

This change implements the two P1 findings and the P2/P3 frontend findings
that have a narrow, testable remediation:

- Preserve saved trailing-stop policy in local review payloads and do not
  claim logout completed until the server confirms it.
- Keep selected candidate snapshots, held-position trade facts, ISO weeks,
  live stop previews, and cross-tab state coherent.
- Surface failed strategy, logout, watchlist, and data-source actions beside
  the action that failed; provide a retry through the original control.
- Use existing ModalShell, Field, native buttons, and established tab
  patterns so keyboard and screen-reader users can operate the audited flows.
- Make touched user-facing copy localizable, calendar formatting locale-aware,
  React Query-key ownership explicit, MSW application requests strict, and
  audited token violations impossible to reintroduce silently.

## Non-goals

- No broker integration, automatic order execution, intraday trading logic,
  risk-model changes, backend endpoint changes, persistence migrations, or
  dependency upgrades.
- No new notification framework or generic tab/modal abstraction. Existing
  primitives already supply the required behavior.
- No broad visual redesign or mobile-layout project. This PR repairs the
  documented interaction and feedback contracts.

## Design decisions

### Correctness and cache ownership

Local-mode serializers retain trail_method and trail_param wherever a position
is sent to a review computation. A held position's entry and initial per-share
risk always take precedence over any candidate add-on draft. A chart uses the
current workspace selection when it corresponds to its ticker, then falls back
to the cached result or direct candle query.

The live-stop preview remains read-only. Its query is explicitly refetched for
every user invocation, keeps the last successful preview visible, and renders
a nearby error if a fetch fails. ISO week IDs use the ISO Thursday/week-year
rule at a normalized UTC date boundary.

All cache-prefix factories live in queryKeys.ts. Cross-tab persistence events
invalidate the same review and strategy-dependent state as equivalent same-tab
mutations; a changed active strategy also clears actionable runs and the
selected workspace candidate.

### Recoverable feedback

Mutations retain their last confirmed data. On failure, the initiating surface
renders an adjacent role="alert" message from the thrown error (with a
localized fallback); the original control stays enabled after the request
settles, which is the retry path. Logout checks Response.ok before clearing
local authentication state. The header's textual data state includes query or
strategy-action failure so it cannot visually contradict a final-close pill.

### Accessible interaction

HelpTooltip and the fullscreen chart compose ModalShell, preserving focus
capture/restoration, Escape, focus containment, labelling, and scroll lock.
Rows with two actions become a non-interactive container containing sibling
native buttons. Selectable table rows expose a keyboard-operable button and
their selection state. Weekly review fields use Field so their visible labels
name the actual textareas. Book and Universes use the existing complete tab
contract: one tab stop, Arrow/Home/End navigation, aria-controls, and a
labelled tabpanel.

### Consistency guardrails

Touched copy is added to messages.en.ts and accessed through t. Calendar date
groups receive the current I18n locale and its legend is derived from all
supported source tags. The token lint rule recognizes directional color
utilities, and the Header/tooltip use existing semantic treatments. MSW fails
unhandled application API calls after the currently missing handlers are
provided.

## Acceptance criteria

- Every audit regression is represented by a failing-first Vitest test and
  passes after its minimal production change.
- A server logout failure leaves the authenticated UI intact and says why.
- A saved non-default trail policy is present in each local review request.
- A selected candidate cannot be rendered with another run's overlays.
- Each audited action is keyboard-operable and dialog focus returns to its
  trigger after close.
- npm test -- --run, npm run typecheck, npm run lint, and npm run build pass
  from web-ui.
