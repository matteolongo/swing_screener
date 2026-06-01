# Web UI Architecture

> Status: current.  
> Last reviewed: 2026-06-01.

## Directory Structure

| Path | Purpose |
|------|---------|
| `src/pages/` | Top-level page components — one file per route |
| `src/features/` | Domain feature dirs — each owns `api.ts`, `hooks.ts`, and types |
| `src/components/domain/` | Reusable domain components (not page-specific) |
| `src/components/common/` | Generic UI primitives |
| `src/types/` | Type transforms: `snake_case` API payload → `camelCase` frontend type |
| `src/lib/` | Shared React Query keys (`queryKeys.ts`), API endpoint constants (`api.ts`) |
| `src/i18n/` | All user-facing strings |
| `src/stores/` | Zustand stores |
| `src/test/` | MSW handlers, `renderWithProviders()`, test utilities |

## Contracts

- API payloads arrive as `snake_case`. Transform functions in `src/types/` convert to `camelCase` before use in components. Never use raw API shape inside components.
- React Query keys live in `src/lib/queryKeys.ts`. Always use these for cache invalidation — do not construct key arrays inline.
- All user-facing strings go through `src/i18n/`. No hardcoded copy in components or tests.

## State

- Server state: React Query (auto-caching and invalidation via query keys).
- Client/UI state: Zustand stores in `src/stores/`.
- No local persistence by default (`VITE_PERSISTENCE_MODE=api`).

## Testing

- Component tests use `renderWithProviders()` — wraps React Query client and Zustand stores.
- API calls mocked via MSW (`src/test/mocks/handlers.ts`).
- Run all tests: `npm test` (Vitest + React Testing Library).
- Run single feature: `npx vitest run src/features/<domain>`.
