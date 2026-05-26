# UX Simplification Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove low-risk beginner-visible UI noise from `Today` and the global header without changing trading logic.

**Architecture:** This stage keeps all existing data fetching and trading actions intact. It only gates advanced UI behind the existing beginner mode store and deletes beginner-default controls that filter or distract from the daily next action.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, MSW, Tailwind CSS, Zustand.

---

### Task 1: Hide Header Risk Summary In Beginner Mode

**Files:**
- Modify: `web-ui/src/components/layout/Header.tsx`
- Test: `web-ui/src/components/layout/Header.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `web-ui/src/components/layout/Header.test.tsx` with tests that mock strategy/portfolio queries and verify the compact risk summary is hidden when beginner mode is enabled and visible when disabled.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Header.test.tsx`

Expected: FAIL because `Header` does not read beginner mode yet.

- [ ] **Step 3: Implement minimal code**

Import `useBeginnerModeStore` in `Header.tsx` and render `StrategyCapitalRiskSummary` only when `!isBeginnerMode`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Header.test.tsx`

Expected: PASS.

### Task 2: Remove Beginner-Default Filters From Today

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/pages/Today.test.tsx`

- [ ] **Step 1: Write failing test**

Replace the existing test that expects the action filter dropdown with a test that verifies the daily review filter controls are absent from the beginner/default `Today` action list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Today.test.tsx`

Expected: FAIL because the filter checkbox and action dropdown are still visible.

- [ ] **Step 3: Implement minimal code**

Remove the `recommendedOnly` and `actionFilter` local state from `TodayActionList`, and stop filtering `newCandidates` / `positionsAddOnCandidates` in the daily action list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Today.test.tsx`

Expected: PASS.

### Task 3: Remove Beginner-Default Intelligence And Catalyst Bars From Today

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/pages/Today.test.tsx`

- [ ] **Step 1: Write failing test**

Change the catalyst scan tests to assert that the catalyst scan button is not rendered in the default `Today` action list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Today.test.tsx`

Expected: FAIL because the catalyst scan button still exists.

- [ ] **Step 3: Implement minimal code**

Remove `useIntelligenceSweepMutation`, `useDailyCatalystScanMutation`, `useLatestCatalystReportQuery`, `handleSweep`, and the two action bars from `TodayActionList`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Today.test.tsx`

Expected: PASS.

### Task 4: Remove Beginner-Default Keyboard Hint From Today

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`

- [ ] **Step 1: Confirm existing keyboard behavior still has coverage**

Run: `npm run test -- Today.test.tsx`

Expected: PASS after Tasks 2-3.

- [ ] **Step 2: Implement minimal code**

Remove the visual keyboard hint footer from `TodayActionList`. Keep the keyboard navigation behavior for now to avoid mixing behavior deletion with visual simplification.

- [ ] **Step 3: Run validation**

Run:
- `npm run typecheck`
- `npm run lint`
- `npm run test -- Today.test.tsx Header.test.tsx`

Expected: all PASS.

### Task 5: Commit Stage 1

**Files:**
- Stage all modified Stage 1 files only.

- [ ] **Step 1: Review diff**

Run: `git diff -- web-ui/src/pages/Today.tsx web-ui/src/pages/Today.test.tsx web-ui/src/components/layout/Header.tsx web-ui/src/components/layout/Header.test.tsx`

- [ ] **Step 2: Commit**

Run:
```bash
git add web-ui/src/pages/Today.tsx web-ui/src/pages/Today.test.tsx web-ui/src/components/layout/Header.tsx web-ui/src/components/layout/Header.test.tsx
git commit -m "Simplify beginner default UI"
```
