# Complexity Audit (PR 9)

## A) Biggest Remaining Complexity Hotspots

### 1) `web-ui/src/pages/DailyReview.tsx`
- Why complex: mixed concerns in a single file (strategy selection, loading/error states, step flow, modals, action handlers, and table column definitions).
- Risk: hard to change one behavior (for example step flow) without touching modal/query logic.
- Suggested follow-up: extract step-specific sections into focused components (`NewTradesStep`, `UpdateStopsStep`, `ClosePositionsStep`) and move table column factories into dedicated modules.

### 2) `web-ui/src/pages/Strategy.tsx`
- Why complex: very large form orchestration (selection/create/update/delete lifecycle + guardrails + advanced unlock + many nested fields).
- Risk: high chance of regression when changing guardrails or advanced settings.
- Suggested follow-up: split into container + section components (`StrategySelectionPanel`, `RiskProfileSection`, `EntryLogicSection`, `AdvancedSection`) and isolate save guardrail logic into a dedicated hook.

### 3) `web-ui/src/i18n/messages.en.ts`
- Why complex: single large translation surface (>1.6k lines) with mixed active and legacy domains.
- Risk: difficult to identify stale keys and easy to introduce dead translations.
- Suggested follow-up: domain-split locale files by route/feature and compose them in i18n runtime.

### 4) `web-ui/src/components/layout/MainLayout.tsx`
- Why complex: layout concerns are coupled to onboarding redirect checks and route-specific sidebar behavior.
- Risk: routing/layout changes can unintentionally affect onboarding flow.
- Suggested follow-up: move onboarding redirect rule into a dedicated guard component/hook and keep `MainLayout` strictly presentational.

## B) LOC / Surface Reduction Summary

Cleanup performed in this PR (frontend only):

- Routes removed: **0** (surface already migrated in earlier PRs).
- Pages removed: **0**.
- Stores removed: **1** (`web-ui/src/stores/screenerStore.ts`).
- Major folders/files removed:
  - `web-ui/src/components/domain/screener/*`
  - `web-ui/src/components/domain/social/SentimentPanel.tsx`
  - `web-ui/src/features/social/*`
  - `web-ui/src/features/screener/{api,hooks,priceHistory,types,viewModel}*`
  - `web-ui/src/components/domain/market/CachedSymbolPriceChart.tsx`
  - `web-ui/src/components/domain/onboarding/TodaysNextActionCard.tsx`
  - `web-ui/src/types/social.ts`

Net change in this PR: ~**2.7k LOC removed** (per git diff).

## C) Remaining Global State Inventory

### `web-ui/src/stores/activeStrategyStore.ts`
- Owns: `activeStrategyId`, `setActiveStrategyId`.
- Why global: strategy context must be shared between route transitions (Decide, Strategy, Archive) without prop drilling.

### `web-ui/src/stores/onboardingStore.ts`
- Owns: onboarding status + current onboarding step lifecycle.
- Why global: onboarding gate and modal/pages need a consistent cross-route progress state.

No other global client stores are required after this cleanup.
