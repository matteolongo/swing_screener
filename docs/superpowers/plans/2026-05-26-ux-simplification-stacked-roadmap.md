# UX Simplification Stacked Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this roadmap task-by-task. Stages are intended as stacked PRs: each stage branch starts from the previous stage branch.

**Goal:** Make the app simpler, more direct, beginner-friendly by default, and smaller by removing repeated or advanced UI from the primary workflow.

**Architecture:** The work is split into stacked branches so each stage is reviewable on its own. Stage 1 removes low-risk default UI noise. Stage 2 reshapes `Today` and Screener hierarchy. Stage 3 simplifies beginner decision language across settings/research/order entry points. Stage 4 refactors oversized components after behavior is stable.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, MSW, Tailwind CSS, Zustand, TanStack Query.

---

## Stacked Branch Order

1. `codex/ux-simplification-roadmap`
   - Docs-only base branch.
   - Contains this roadmap and stage plans.

2. `codex/ux-simplification-stage-1`
   - Branch from `codex/ux-simplification-roadmap`.
   - Remove or hide low-risk beginner-visible noise.

3. `codex/ux-simplification-stage-2`
   - Branch from `codex/ux-simplification-stage-1`.
   - Rework `Today` and Screener default hierarchy.

4. `codex/ux-simplification-stage-3`
   - Branch from `codex/ux-simplification-stage-2`.
   - Tighten beginner copy, settings, research, and order gates.

5. `codex/ux-simplification-stage-4`
   - Branch from `codex/ux-simplification-stage-3`.
   - Split large files and remove repeated view logic once behavior is covered.

## Stage Goals

### Stage 1: Safe Deletions And Default Hiding

Reduce beginner-visible noise without changing trading logic.

Files:
- `web-ui/src/pages/Today.tsx`
- `web-ui/src/pages/Today.test.tsx`
- `web-ui/src/components/layout/Header.tsx`
- `web-ui/src/components/layout/Header.test.tsx` if needed

Expected changes:
- Hide the global capital/risk summary from the header in beginner mode.
- Remove `Today` action-list filters from beginner/default view.
- Remove `Today` intelligence sweep and catalyst scan bars from beginner/default view.
- Remove the keyboard shortcut hint from beginner/default view.

Validation:
- `npm run typecheck`
- `npm run lint`
- `npm run test -- Today.test.tsx`

### Stage 2: Today And Screener Hierarchy

Make the first-screen experience answer: "What should I do now?"

Files:
- `web-ui/src/pages/Today.tsx`
- `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx`
- `web-ui/src/components/domain/screener/ScreenerForm.tsx`
- Existing tests near those components

Expected changes:
- Keep `TodayPriorityCard` as the primary object.
- Collapse secondary action categories under "More today".
- Default Screener controls to collapsed run summary.
- Keep advanced filters behind `Adjust filters`.

Validation:
- `npm run typecheck`
- `npm run lint`
- `npm run test -- Today.test.tsx ScreenerForm.test.tsx`

### Stage 3: Beginner Copy And Control Simplification

Remove duplicated instructions and make beginner controls direct.

Files:
- `web-ui/src/pages/Strategy.tsx`
- `web-ui/src/pages/Research.tsx`
- `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- `web-ui/src/i18n/messages.en.ts`

Expected changes:
- Put strategy lifecycle actions behind a manage section.
- Reduce `Research` provider/warmup details in the default view.
- Make order review start with a decision/risk/ticket sequence.
- Keep broker steps collapsed and secondary.

Validation:
- `npm run typecheck`
- `npm run lint`
- Relevant page/component tests.

### Stage 4: Structural Code Reduction

Split and delete after behavior is stable.

Files:
- `web-ui/src/pages/Today.tsx`
- `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- `web-ui/src/pages/Strategy.tsx`
- New focused helper/components only where they reduce complexity.

Expected changes:
- Extract a pure daily-action list model from `Today`.
- Split order review into decision summary, order ticket, and broker guide.
- Move strategy help config out of `Strategy.tsx`.
- Delete helpers made obsolete by earlier stages.

Validation:
- `npm run typecheck`
- `npm run lint`
- `npm run test`

## Review Rules

- Each branch should be independently reviewable.
- Each PR should include its own tests and should not depend on hidden local state.
- Prefer deletion or hiding over new abstractions until Stage 4.
- Do not change backend ranking, portfolio, or order logic unless a frontend contract is already insufficient.
- Preserve expert access to advanced controls, but stop showing those controls in the beginner path.
