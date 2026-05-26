# UX Simplification Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Today` and Screener default to a beginner-first hierarchy centered on one next action.

**Architecture:** This stage changes layout hierarchy, not trading logic. It keeps existing daily review and screener APIs but makes `TodayPriorityCard` the top-level decision object and moves secondary action groups and screener filters behind explicit disclosure.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, MSW, Tailwind CSS, Zustand.

---

### Task 1: Collapse Secondary Today Sections

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/pages/Today.test.tsx`

- [ ] **Step 1: Write failing test**

Add a test where daily review returns required action, pending orders, watchlist, opportunities, and holds. Assert that the priority card is visible immediately and secondary section labels are not visible until the user clicks `More today`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Today.test.tsx`

Expected: FAIL because secondary sections are currently visible immediately.

- [ ] **Step 3: Implement minimal code**

Add a local `showMoreToday` state around the action sections and render a single `More today` disclosure button when secondary items exist.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Today.test.tsx`

Expected: PASS.

### Task 2: Default Screener Form To Collapsed Summary

**Files:**
- Modify: `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx`
- Add or modify: `web-ui/src/components/domain/workspace/ScreenerInboxPanel.test.tsx`

- [ ] **Step 1: Write failing test**

Render `ScreenerInboxPanel` with mocked strategy/config/universe queries. Assert that the default view shows `Adjust filters` and does not show the full `Decision Action` filter.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- ScreenerInboxPanel.test.tsx`

Expected: FAIL because `isFormCollapsed` defaults to false.

- [ ] **Step 3: Implement minimal code**

Change the `useLocalStorage('screener-form-collapsed', false)` default to `true`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- ScreenerInboxPanel.test.tsx`

Expected: PASS.

### Task 3: Rename And Tighten Screener Filter Disclosure

**Files:**
- Modify: `web-ui/src/components/domain/screener/ScreenerForm.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Write failing test**

Assert the collapsed control reads `Advanced filters` or another approved short label instead of a vague settings phrase.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- ScreenerInboxPanel.test.tsx`

Expected: FAIL until copy is updated.

- [ ] **Step 3: Implement minimal code**

Update the i18n key and button label.

- [ ] **Step 4: Run validation**

Run:
- `npm run typecheck`
- `npm run lint`
- `npm run test -- Today.test.tsx ScreenerInboxPanel.test.tsx`

Expected: all PASS.

### Task 4: Commit Stage 2

Run:
```bash
git add web-ui/src/pages/Today.tsx web-ui/src/pages/Today.test.tsx web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx web-ui/src/components/domain/workspace/ScreenerInboxPanel.test.tsx web-ui/src/components/domain/screener/ScreenerForm.tsx web-ui/src/i18n/messages.en.ts
git commit -m "Make Today and Screener beginner-first"
```
