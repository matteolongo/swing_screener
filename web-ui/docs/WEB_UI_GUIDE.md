# Web UI Guide

> Status: current.  
> Last reviewed: 2026-06-01.

## Purpose

Daily trading workflow through the Swing Screener web interface.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Compute daily review, check pending orders, open risk summary |
| Calendar | `/calendar` | Earnings calendar, upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management: create, fill, cancel |
| Research | `/research` | Screener run and candidates, symbol intelligence analysis, watchlist |
| Universes | `/universes` | Universe management, manual refresh, benchmark |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Journal | `/journal` | Weekly reviews and trade log |
| Onboarding | `/onboarding` | Setup guide for new users |
| Analytics | `/analytics` | Regime breakdown and performance analytics |
| Fundamentals | `/fundamentals` | Fundamental data browser: snapshot, compare, warmup |

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book, Today | Order lifecycle: create, fill, cancel |
| `features/screener` | Research | Screener run, candidates, recurrence state |
| `features/intelligence` | Research | Symbol analysis (LLM), cached results, sweep |
| `features/watchlist` | Research | Watchlist CRUD |
| `features/dailyReview` | Today | Daily review compute and structured result |
| `features/analytics` | Analytics | Regime breakdown, performance stats |
| `features/fundamentals` | Fundamentals | Fundamental snapshots, compare, warmup job |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Journal | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | Universes | Universe list, detail, refresh, benchmark |
| `features/config` | (cross-cutting) | App config read/write |
| `features/persistence` | (cross-cutting) | API vs localStorage mode toggle |

## Typical Workflow

1. Start API and web UI.
2. **Today** — compute daily review, check pending orders.
3. **Research** — run screener, review candidates, trigger intelligence analysis.
4. Create orders via **Book**.
5. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npm test` before and after any change.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.
