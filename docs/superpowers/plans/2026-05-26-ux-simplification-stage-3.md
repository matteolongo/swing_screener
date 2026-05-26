# UX Simplification Stage 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify beginner copy and controls across Settings, Research, and Order.

**Architecture:** This stage keeps advanced features available but moves setup/admin details behind manage or advanced disclosures. It reduces repeated instructions and makes the visible default path use direct action language.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, MSW, Tailwind CSS, Zustand.

---

### Task 1: Put Strategy Lifecycle Controls Behind Manage Strategies

**Files:**
- Modify: `web-ui/src/pages/Strategy.tsx`
- Modify: `web-ui/src/pages/Strategy.test.tsx`

- [ ] **Step 1: Write failing test**

Assert `Save as New`, new ID, new name, new description, and delete controls are not visible by default in beginner mode. Assert they appear after clicking `Manage strategies`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Strategy.test.tsx`

Expected: FAIL because lifecycle controls are currently visible.

- [ ] **Step 3: Implement minimal code**

Add local disclosure state around the create/delete controls. Leave strategy selection visible.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Strategy.test.tsx`

Expected: PASS.

### Task 2: Hide Research Provider And Warmup Details By Default

**Files:**
- Modify: `web-ui/src/pages/Research.tsx`
- Modify: `web-ui/src/pages/Fundamentals.tsx`
- Modify: `web-ui/src/pages/Fundamentals.test.tsx`

- [ ] **Step 1: Write failing test**

Assert Research default shows symbol search and compare action, but provider/cache/warmup details are hidden until `Advanced research tools` is opened.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- Fundamentals.test.tsx`

Expected: FAIL because provider/cache/warmup details are visible.

- [ ] **Step 3: Implement minimal code**

Pass an optional `defaultSimple` prop from `Research` to `FundamentalsPage` and wrap provider/cache/warmup controls in a disclosure.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- Fundamentals.test.tsx`

Expected: PASS.

### Task 3: Simplify Order Flow Headings And Broker Guidance

**Files:**
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx`

- [ ] **Step 1: Write failing test**

Assert the visible order flow shows one clear order ticket heading and keeps broker steps collapsed by default.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- OrderReviewExperience.test.tsx`

Expected: FAIL if broker steps or duplicated caution blocks are visible by default.

- [ ] **Step 3: Implement minimal code**

Remove duplicated execution caution in the review tab when it is already shown beside the form, and keep broker steps collapsed.

- [ ] **Step 4: Run validation**

Run:
- `npm run typecheck`
- `npm run lint`
- `npm run test -- Strategy.test.tsx Fundamentals.test.tsx OrderReviewExperience.test.tsx`

Expected: all PASS.

### Task 4: Commit Stage 3

Run:
```bash
git add web-ui/src/pages/Strategy.tsx web-ui/src/pages/Strategy.test.tsx web-ui/src/pages/Research.tsx web-ui/src/pages/Fundamentals.tsx web-ui/src/pages/Fundamentals.test.tsx web-ui/src/components/domain/orders/OrderReviewExperience.tsx web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx
git commit -m "Simplify beginner settings research and order flow"
```
