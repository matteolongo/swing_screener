# Mobile-First Beginner UX Audit (2026-02-27)

## Scope
- App: `web-ui` served by local API (`http://127.0.0.1:8000`)
- Devices tested: `iPhone 13` (390x664), `iPhone SE` (320x568)
- Routes tested:
  - `/workspace`
  - `/daily-review`
  - `/strategy`
  - `/intelligence`
- Flow tested in Workspace:
  - run screener
  - open symbol details
  - switch to order tab
  - verify place-buy action
  - close and return

## Phase 1 Status (Implemented)
- Date: 2026-02-27
- Delivery completed:
  - 44px+ tap target baseline on mobile controls
  - accessible naming fixes for select/button controls
  - heading hierarchy normalization in card sections
  - contrast improvements for positive/negative metric colors
- Latest validation run:
  - iPhone 13: `workspace/daily-review/strategy/intelligence` => `tap 0 undersized`, `axe 0 violations`
  - iPhone SE: `workspace/daily-review/strategy/intelligence` => `tap 0 undersized`, `axe 0 violations`

## Phase 2 Kickoff (Started)
- Date: 2026-02-27
- Delivery in progress:
  - persistent mobile bottom navigation for Workspace, Daily Review, Strategy, Intelligence
  - beginner-first quick-start guidance on Intelligence page
  - advanced Intelligence configuration hidden behind explicit reveal action
  - Daily Review loading skeletons to avoid blank-screen wait state

## Current Status (Latest)
- Date: 2026-02-27
- Latest validation run:
  - iPhone 13: `workspace/daily-review/strategy/intelligence` => `tap 0 undersized`, `axe 0 violations`, `overflow false`
  - iPhone SE: `workspace/daily-review/strategy/intelligence` => `tap 0 undersized`, `axe 0 violations`, `overflow false`
- Workspace symbol-detail flow:
  - run screener triggered
  - symbol modal opened
  - full-screen mobile modal confirmed
  - background scroll lock confirmed
  - `Place Buy Order` action visible
  - `Order` tab selected after CTA
  - `Create Order` button visible
  - back closes modal and returns to workspace

## Phase 3 Progress (In Progress)
- Implemented:
  - Workspace screener candidate cards for mobile (reduced table density)
  - Daily Review section card layouts on mobile
  - Daily Review `Next Best Action` card
  - Strategy beginner quick-start and mobile sticky save/reset actions
  - Intelligence post-run workspace handoff (`Open Workspace`) and mobile sticky run action
- Quality guardrails added:
  - mobile audit selector logic updated to support both table and card candidate layouts
  - targeted regression tests added for:
    - Strategy beginner mobile management-toggle flow
    - Intelligence sticky run guidance and post-run workspace action

## Audit Method
- Live navigation with Playwright mobile contexts.
- Automated checks per page:
  - viewport overflow
  - visible tap-target sizing (44px minimum rule)
  - Axe accessibility scan
- Evidence captured:
  - JSON report
  - per-page screenshots
  - symbol-detail modal screenshots

## Baseline Findings (Historical)

### P0: Tap targets are below mobile minimum in critical controls
Observed on both devices and all primary pages.

Examples:
- Header buttons:
  - nav toggle `32x40`
  - mode toggle `38x40`
  - getting started `40x40`
- Workspace:
  - `Run Screener` button height `40`
  - `Show advanced filters` tap height `20`
  - universe select height `38`
- Intelligence:
  - multiple form inputs/selects at `29-30` height

Impact:
- High miss-tap risk and poor one-handed ergonomics.
- Violates mobile-first touch ergonomics (44x44 minimum).

### P0: Accessibility blockers on form controls
Axe `critical` issues across routes:
- `select-name`: select fields missing accessible names.
- `button-name`: one or more icon-only/unnamed buttons.

Impact:
- Screen-reader usability is degraded.
- Beginner users lose context when controls are unlabeled.

### P1: Beginner mode is visually enabled but cognitively overloaded
`/intelligence` and `/strategy` expose many advanced knobs immediately.

Observed behavior:
- Dense technical forms dominate first screen.
- Minimal task framing for beginners.
- Important user intent ("what should I do next?") is not prioritized.

Impact:
- New users face high decision friction.
- Low confidence in first-session completion.

### P1: Workspace candidate/action area is too compact on mobile
On small screens, candidate info and actions are compressed into table-like density.

Observed behavior:
- Symbol and recommendation controls are tightly packed.
- Small secondary affordances (icons/links) compete with primary CTA.

Impact:
- Harder to scan and act quickly.
- Inconsistent with beginner-first progression.

### P1: Daily Review hierarchy is dense and icon-driven
Mobile review page relies on compact rows and small controls.

Observed behavior:
- Many sections and compact controls in a single scroll pass.
- Summary cards and actions are not strongly sequenced.

Impact:
- Beginner users may not know what action matters most now.

### P2: Mobile navigation is functional but not fast for repeated use
Drawer navigation works, but there is no persistent bottom quick-nav.

Observed behavior:
- Hamburger menu required for section switching.
- Extra tap cost for frequent route changes.

Impact:
- Slower navigation loops for daily workflows.

## Positive Validation (Recent Fixes)
- Symbol detail modal flow now works as intended on mobile:
  - full-screen presentation on mobile
  - background scroll locked
  - clear `Place Buy Order` action
  - order tab reachable from details
  - back returns to workspace

## Recommended Delivery Plan

### Phase 1 (Immediate)
- Raise mobile touch targets to at least `44px` for all primary controls.
- Standardize input/select/button heights to `44-48px`.
- Fix all `select-name` and `button-name` accessibility violations.
- Ensure icon-only controls always have visible label or `aria-label`.

### Phase 2 (Beginner Flow First)
- Define a strict primary flow:
  1. Run screener
  2. Open top candidate
  3. Confirm setup in plain language
  4. Place buy order
- Move advanced filters/config under explicit "Advanced" accordions.
- Add persistent "Next best action" strip on mobile.

### Phase 3 (Mobile Information Architecture)
- Replace dense tables with card/list primitives on mobile breakpoints.
- Introduce optional bottom tab navigation for 4 primary sections.
- Keep drawer for secondary/advanced areas.

### Phase 4 (Polish + Trust)
- Improve low-contrast text tokens flagged by Axe.
- Ensure heading hierarchy increments correctly (`h1 -> h2 -> h3`).
- Add UX microcopy tuned for beginners ("why this matters", "what to do now").

## Success Criteria
- `0` critical Axe violations on tested routes.
- `0` visible interactive elements under `44px` height.
- Beginner first-task completion path reachable in <= 3 taps from Workspace load.
- Mobile user can place a buy order without touching advanced settings.

## Evidence
- Audit report JSON:
  - `/Users/matteo.longo/projects/randomness/trading/swing_screener/web-ui/.audit/mobile-ux-audit-2026-02-27T12-37-59-773Z/report.json`
- Representative screenshots:
  - Workspace: `/Users/matteo.longo/projects/randomness/trading/swing_screener/web-ui/.audit/mobile-ux-audit-2026-02-27T12-37-59-773Z/iphone-13/workspace.png`
  - Workspace symbol modal: `/Users/matteo.longo/projects/randomness/trading/swing_screener/web-ui/.audit/mobile-ux-audit-2026-02-27T12-37-59-773Z/iphone-13/workspace-symbol-modal.png`
  - Daily Review: `/Users/matteo.longo/projects/randomness/trading/swing_screener/web-ui/.audit/mobile-ux-audit-2026-02-27T12-37-59-773Z/iphone-13/daily-review.png`
  - Strategy: `/Users/matteo.longo/projects/randomness/trading/swing_screener/web-ui/.audit/mobile-ux-audit-2026-02-27T12-37-59-773Z/iphone-13/strategy.png`
  - Intelligence: `/Users/matteo.longo/projects/randomness/trading/swing_screener/web-ui/.audit/mobile-ux-audit-2026-02-27T12-37-59-773Z/iphone-13/intelligence.png`

## Re-run Command
From `web-ui/`:

```bash
node ./scripts/mobile_ux_audit.mjs
```
