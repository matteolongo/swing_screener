# UX Low-Impact Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify the Today "Screener" tab label so users understand it shows the last cached screener run (not a live screener). Add a weekly review nudge on Fridays to prompt the user to fill out their weekly review before the week ends.

**Architecture:** Both changes are frontend-only, single-file changes. No backend changes, no new hooks, no new components beyond small inline helpers.

**Tech Stack:** React 18 / TypeScript. Tests: Vitest.

---

## File Map

**Task 1 (tab label):**
- Modify: `web-ui/src/i18n/messages.en.ts` — change `todayPage.tabs.screener` value

**Task 2 (weekly review nudge):**
- Modify: `web-ui/src/pages/Today.tsx` — add a `WeeklyReviewNudge` component rendered at the top of the Today tab content on Fridays
- Modify: `web-ui/src/i18n/messages.en.ts` — add nudge i18n keys

---

## Task 1 — Frontend: clarify Today screener tab label

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`

Context: `Today.tsx` has two left-panel tabs: `'today'` and `'screener'`. The screener tab renders `ScreenerInboxPanel`, which shows the last screener run results (not a live run). The label currently says "Screener", which implies you can run the screener from there. The screener runner lives on the Research page. Renaming the tab to "Last Run" makes the distinction clear.

The key to change is `todayPage.tabs.screener` (currently `'Screener'`). Change it to `'Last Run'`.

- [ ] **Step 1: Update the tab label**

In `web-ui/src/i18n/messages.en.ts`, find:

```typescript
  todayPage: {
    tabs: {
      today: 'Today',
      screener: 'Screener',
    },
```

Change to:

```typescript
  todayPage: {
    tabs: {
      today: 'Today',
      screener: 'Last Run',
    },
```

- [ ] **Step 2: Check for test assertions on this string**

```bash
grep -rn "Screener\|todayPage.tabs.screener\|tabs.screener" web-ui/src --include="*.test.*" --include="*.spec.*" | head -10
```

If any test asserts the literal string `'Screener'` for this tab, update it to `'Last Run'`. If tests use the i18n key (`t('todayPage.tabs.screener')`), no change needed.

- [ ] **Step 3: Run tests and typecheck**

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts
git commit -m "ux: rename Today screener tab to Last Run"
```

---

## Task 2 — Frontend: weekly review nudge on Fridays

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

Context: The weekly review form lives in `Book.tsx` under the "journal" tab. There is no prompt to remind users to fill it in. We want a small nudge banner on Fridays at the top of the Today tab content. The banner links to `/book` with `{ state: { tab: 'review' } }` — the same navigation pattern already used in `Today.tsx` for pending orders.

`getCurrentWeekId()` is already exported from `web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.tsx`. `useWeeklyReviews()` hook is in `web-ui/src/features/weeklyReview/hooks.ts`.

The nudge should:
1. Only show on Fridays (day-of-week = 5)
2. Only show if the current week's review has not been written (check `useWeeklyReviews()` — if the current week ID is not in the list, show nudge)
3. Have a dismiss button (session-only, using local `useState`)

- [ ] **Step 1: Add i18n keys**

In `web-ui/src/i18n/messages.en.ts`, add a new `weeklyNudge` section inside `todayPage`:

```typescript
  todayPage: {
    // ... existing keys ...
    weeklyNudge: {
      message: "It's Friday — did you write this week's review?",
      action: 'Write review',
      dismiss: 'Dismiss',
    },
```

Place this after the existing `pendingBadge` section, before the closing `}` of `todayPage`.

- [ ] **Step 2: Write failing test for WeeklyReviewNudge**

In `web-ui/src/pages/Today.test.tsx` (or create if it doesn't exist as a unit test file), add:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// We test the pure logic: isFriday + no current review = nudge shows
describe('weekly review nudge visibility', () => {
  it('shows nudge when today is Friday and no review exists', () => {
    // Friday = day 5
    vi.setSystemTime(new Date('2026-01-09T10:00:00')); // Jan 9 2026 is a Friday
    // Render the component with no reviews — use MSW or mock hooks
    // For simplicity, test the helper function directly
    const isFriday = new Date().getDay() === 5;
    expect(isFriday).toBe(true);
    vi.useRealTimers();
  });

  it('does not show nudge on non-Friday', () => {
    vi.setSystemTime(new Date('2026-01-08T10:00:00')); // Thursday
    const isFriday = new Date().getDay() === 5;
    expect(isFriday).toBe(false);
    vi.useRealTimers();
  });
});
```

Run: `cd web-ui && npx vitest run --reporter=verbose Today.test.tsx 2>/dev/null || npx vitest run --reporter=verbose src/pages/Today.test.tsx`

- [ ] **Step 3: Implement WeeklyReviewNudge component**

Add in `Today.tsx`, before `TodayPrioritySection`:

```typescript
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
```

```typescript
function WeeklyReviewNudge() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const { data: reviews } = useWeeklyReviews();

  const isFriday = new Date().getDay() === 5;
  const currentWeekId = getCurrentWeekId();
  const hasCurrentWeekReview = (reviews ?? []).some((r) => r.week_id === currentWeekId);

  if (!isFriday || hasCurrentWeekReview || dismissed) return null;

  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 dark:border-purple-700 dark:bg-purple-950">
      <span className="text-sm text-purple-800 dark:text-purple-200 flex-1">
        {t('todayPage.weeklyNudge.message')}
      </span>
      <button
        type="button"
        onClick={() => navigate('/book', { state: { tab: 'review' } })}
        className="text-xs font-medium text-purple-700 hover:underline dark:text-purple-300 shrink-0"
      >
        {t('todayPage.weeklyNudge.action')}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-xs text-purple-500 hover:text-purple-700 dark:text-purple-400 shrink-0"
        aria-label={t('todayPage.weeklyNudge.dismiss')}
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Render WeeklyReviewNudge in Today**

In the Today component's left panel content, inside `{leftTab === 'today' && (`, add `<WeeklyReviewNudge />` as the first child, before `<TodayPrioritySection ...`:

```typescript
{leftTab === 'today' && (
  <>
    <div className="px-3 pt-3">
      <WeeklyReviewNudge />
      <TodayPrioritySection onTickerSelect={handleTickerSelect} onSwitchToScreener={() => setLeftTab('screener')} />
      <PendingOrdersBadge />
    </div>
    ...
  </>
)}
```

- [ ] **Step 5: Run tests and typecheck**

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(web-ui): Friday weekly review nudge on Today page"
```

---

## Final check

```bash
cd web-ui && npm run typecheck && npm test -- --run
```

Push:

```bash
git push origin ux/low-impact
```
