# Web UI Architecture

> **Status: Current.**  
> **Last Reviewed:** February 17, 2026.

## Goals

- Keep page components thin and readable.
- Reuse domain UI patterns (tables, modals, recommendation blocks, order forms).
- Keep API contracts explicit and transformed only at boundaries.
- Reduce cache-key drift and invalidation bugs.
- Prepare UI copy for future i18n adoption.

## Layers

1. `pages/`
- Route-level orchestration, section composition, minimal wiring.

2. `components/common/`
- Generic primitives (`Button`, `Card`, `ModalShell`, `TableShell`, `TableState`).

3. `components/domain/`
- Feature-specific reusable blocks (recommendation details, candidate order modal, settings blocks, etc.).

4. `features/`
- API calls + React Query hooks per domain.

5. `types/`
- Canonical frontend types + snake_case/camelCase transforms.

6. `lib/`
- Shared app contracts (`queryKeys`, invalidation helpers, base API URL).

7. `i18n/`
- Key-ready message registry (`messages.en.ts`) and translator helper (`t`).

## Query and Cache Rules

- Never hardcode React Query keys in pages/components.
- Use `src/lib/queryKeys.ts` for all keys.
- Use `src/lib/queryInvalidation.ts` for multi-key invalidation patterns.

## Form Rules

- Prefer `react-hook-form` + `zod` for modal forms.
- Keep validation schema in `components/domain/<domain>/schemas.ts`.
- Keep display-only calculations in small hooks/helpers (`useOrderRiskMetrics`).

## Table Rules

- Use `TableShell` for loading/empty/error and container consistency.
- Keep row rendering in page/domain-level table components.

## Modal Rules

- Use `ModalShell` for backdrop handling, Escape close, and standard header/close button behavior.

## i18n-Key Readiness Rules

- New or changed copy in refactored code should be key-based via `t('...')`.
- Keys use dot paths: `page.section.element`.
- Dynamic strings use placeholders: `{{ticker}}`, never concatenation.

## Current Phase Scope (Phase 1)

- Refactored pages: Screener, DailyReview, Orders, Positions.
- Centralized strategy hooks and query key usage.
- Added shared recommendation/order components.
- Added key-ready i18n utilities without introducing an i18n dependency.

## Deferred (Phase 2)

- Strategy page decomposition into smaller domain sections.
- Backtest page decomposition into smaller parameter/report panels.
- Full app-wide migration of legacy literals into i18n keys.
