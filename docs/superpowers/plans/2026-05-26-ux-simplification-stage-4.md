# UX Simplification Stage 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce frontend code size and repeated view logic after the UX behavior has been simplified and tested.

**Architecture:** This stage is intentionally last. It extracts pure view-model logic and focused components only where the previous stages left clear stable boundaries.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, MSW, Tailwind CSS, Zustand.

---

### Task 1: Extract Today Daily Action View Model

**Files:**
- Create: `web-ui/src/features/dailyReview/actionListViewModel.ts`
- Create: `web-ui/src/features/dailyReview/actionListViewModel.test.ts`
- Modify: `web-ui/src/pages/Today.tsx`

- [ ] **Step 1: Write failing test**

Create tests that input a daily review object and assert ordered sections: requires action, pending orders, watchlist, opportunities, holding.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- actionListViewModel.test.ts`

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Implement minimal code**

Move section count/order logic from `Today.tsx` into the pure view-model helper.

- [ ] **Step 4: Refactor Today**

Use the view model in `TodayActionList` and delete repeated count logic.

- [ ] **Step 5: Run tests**

Run: `npm run test -- actionListViewModel.test.ts Today.test.tsx`

Expected: PASS.

### Task 2: Split Order Review Experience

**Files:**
- Create: `web-ui/src/components/domain/orders/OrderDecisionReview.tsx`
- Create: `web-ui/src/components/domain/orders/OrderTicketForm.tsx`
- Create: `web-ui/src/components/domain/orders/OrderBrokerGuide.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx`

- [ ] **Step 1: Write characterization tests**

Assert existing order creation, validation, warnings, and broker-guide visibility still work.

- [ ] **Step 2: Run tests before refactor**

Run: `npm run test -- OrderReviewExperience.test.tsx`

Expected: PASS before extraction.

- [ ] **Step 3: Extract components one at a time**

Move decision review, ticket form, and broker guide into focused files. Keep props explicit and avoid new shared context.

- [ ] **Step 4: Run tests after each extraction**

Run: `npm run test -- OrderReviewExperience.test.tsx`

Expected: PASS after each extraction.

### Task 3: Move Strategy Help Config Out Of Page

**Files:**
- Create: `web-ui/src/features/strategy/helpConfig.ts`
- Modify: `web-ui/src/pages/Strategy.tsx`
- Add or modify: `web-ui/src/features/strategy/helpConfig.test.ts`

- [ ] **Step 1: Write failing test**

Assert `buildStrategyHelpConfig(t)` returns keys required by `StrategyCoreSettingsCards` and `StrategyAdvancedSettingsCard`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- helpConfig.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement helper**

Move the help object builder from `Strategy.tsx` into `helpConfig.ts`.

- [ ] **Step 4: Refactor Strategy page**

Replace inline help object with `useMemo(() => buildStrategyHelpConfig(t), [t])`.

- [ ] **Step 5: Run validation**

Run:
- `npm run typecheck`
- `npm run lint`
- `npm run test`

Expected: all PASS.

### Task 4: Commit Stage 4

Run:
```bash
git add web-ui/src/features/dailyReview/actionListViewModel.ts web-ui/src/features/dailyReview/actionListViewModel.test.ts web-ui/src/pages/Today.tsx web-ui/src/components/domain/orders/OrderDecisionReview.tsx web-ui/src/components/domain/orders/OrderTicketForm.tsx web-ui/src/components/domain/orders/OrderBrokerGuide.tsx web-ui/src/components/domain/orders/OrderReviewExperience.tsx web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx web-ui/src/features/strategy/helpConfig.ts web-ui/src/features/strategy/helpConfig.test.ts web-ui/src/pages/Strategy.tsx
git commit -m "Reduce UX component complexity"
```
