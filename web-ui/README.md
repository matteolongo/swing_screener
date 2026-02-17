# Swing Screener Web UI

React + TypeScript frontend for the Swing Screener system.

## Documentation

- `web-ui/docs/WEB_UI_GUIDE.md`
- `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- `web-ui/docs/DAILY_REVIEW_IMPLEMENTATION.md` (archived snapshot)
- `docs/overview/INDEX.md` (full documentation map)

## Functional Areas

- **Dashboard**: portfolio summary and action items
- **Screener**: run screens, review candidates, create orders
- **Orders**: list, create, fill, cancel
- **Positions**: open/closed positions, stop updates
- **Strategy**: list and activate strategies
- **Backtest**: run quick/full backtests and review simulations
- **Daily Review**: consolidated workflow view
- **Settings**: local preferences and configuration

## Current Architecture

- Routing and page composition: `src/App.tsx`, `src/pages/*`
- Shared UI primitives: `src/components/common/*`
- Domain components: `src/components/domain/*`
- Feature API/hooks: `src/features/*`
- State stores (minimal): `src/stores/*`
- Type transforms (snake_case API -> camelCase UI): `src/types/*`
- Formatting/utilities: `src/utils/*`
- i18n-key-ready messages and translator helper: `src/i18n/*`

## Key Patterns

1. Backend contracts stay snake_case; transform only at API boundary.
2. Shared query keys are centralized in `src/lib/queryKeys.ts`.
3. Cross-query invalidation helpers live in `src/lib/queryInvalidation.ts`.
4. Modal and table scaffolding are standardized via:
   - `src/components/common/ModalShell.tsx`
   - `src/components/common/TableShell.tsx`
5. New reusable recommendation and order flows live in:
   - `src/components/domain/recommendation/*`
   - `src/components/domain/orders/*`
6. Touched UI strings are key-based through `t('...')` with defaults in `messages.en.ts`.

## Development

```bash
cd web-ui
npm install
npm run dev
```

## Validation Commands

```bash
cd web-ui
npm run lint
npm test
npm run test:coverage
```
