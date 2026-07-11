# Frontend Code Review Implementation Plan

> **Execution mode:** findings-only frontend review. Use `/workspace/swing_screener` as the repository root in this environment. If running elsewhere, replace that prefix with the checkout root returned by `pwd`.

## Goal

Produce an exhaustive, evidence-based review of `web-ui/` with ranked findings and recommendations only.

## Architecture

Review `web-ui/src` through ten independent dimensions, using docs/configs/source maps as the baseline and proving every finding with a failing test, concrete reproduction, or quoted rule/spec citation. Backend files are read-only contract references; findings should target frontend code unless the defect is doc drift.

## Tech Stack

React 18, TypeScript strict, Vite 5, Vitest + React Testing Library + happy-dom + MSW, TanStack React Query v5, Zustand, Tailwind, lightweight-charts v5, custom i18n runtime.

## Scope + Method

### In scope

- `web-ui/src/**/*.{ts,tsx}`
- `web-ui/src/**/*.test.{ts,tsx}`
- `web-ui/src/i18n/messages.en.ts`
- `web-ui/src/test/**`
- `web-ui/__mocks__/**`
- frontend config/docs needed to judge source rules

### Read-only references

- `CLAUDE.md`
- `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- `web-ui/docs/WEB_UI_GUIDE.md`
- `web-ui/package.json`
- `web-ui/tsconfig*.json`
- `web-ui/vite.config.ts`
- `web-ui/vitest.config.ts`
- `web-ui/eslint.config.mjs`
- `api/README.md`
- `api/models/**/*.py`
- `api/routers/**/*.py`
- `src/swing_screener/intelligence/**/*.py`
- `src/swing_screener/recommendation/**/*.py`

### Out of scope

- backend business logic review
- generated/build output
- `web-ui/node_modules`
- `web-ui/dist`
- `web-ui/coverage`
- package upgrade work
- any application-code changes during this review pass

### Gather target map

```bash
cd /workspace/swing_screener/web-ui
rg --files src -g '*.ts' -g '*.tsx' | sort
find src/features -maxdepth 2 -type f | sort
find src/components -maxdepth 4 -type f | sort
find src/lib src/i18n src/stores src/test -maxdepth 3 -type f | sort
```

### Entry points

- `src/main.tsx`
- `src/App.tsx`
- `src/pages/Today.tsx`
- `src/pages/Book.tsx`
- `src/pages/Universes.tsx`
- `src/pages/Strategy.tsx`
- `src/pages/DataSources.tsx`
- `src/pages/Calendar.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/Analytics.tsx`

### High-risk component targets

- `src/components/domain/workspace/AnalysisCanvasPanel.tsx`
- `src/components/domain/workspace/SymbolAnalysisContent.tsx`
- `src/components/domain/workspace/ScreenerInboxPanel.tsx`
- `src/components/domain/workspace/NarrativeAnalysisCard.tsx`
- `src/components/domain/workspace/ActionPanel.tsx`
- `src/components/domain/workspace/PortfolioTable.tsx`
- `src/components/domain/today/**`
- `src/components/domain/orders/**`
- `src/components/domain/market/CandleChart.tsx`
- `src/components/domain/market/CachedSymbolCandleChart.tsx`

### Known doc/source drift to reverify as review input, not pre-accepted findings

- `WEB_UI_GUIDE.md` says `CandleChart` is hand-rolled SVG; actual chart code uses `lightweight-charts`.
- `WEB_UI_ARCHITECTURE.md` says feature dirs each own `api.ts`, `hooks.ts`, and types; actual exceptions include `analytics`, `orders`, `persistence`, `config`, `dailyReview`, and `weeklyReview`.
- `WEB_UI_ARCHITECTURE.md` says transforms live in `src/types/`; actual transforms also live in feature files such as `features/screener/types.ts`, `features/intelligence/types.ts`, `features/backtest/types.ts`, `features/volumeZones/types.ts`, `features/dailyReview/types.ts`, and `features/datasources/types.ts`.
- `WEB_UI_ARCHITECTURE.md` says React Query keys live in `src/lib/queryKeys.ts`; actual inline keys appear in hooks for intelligence, weekly review, portfolio, pool enrichment, screener recurrence, and catalysts.
- `eslint.config.mjs` disables `react-hooks/exhaustive-deps`; stale closure/effect dependency review must be manual.
- ESLint i18n enforcement applies only to selected files; manual i18n scan is required across all components and tests.
- `WEB_UI_ARCHITECTURE.md` says no local persistence by default; actual stores intentionally persist onboarding via localStorage middleware and screener last result via IndexedDB.

## Work Items

### 1. Correctness / Bugs

**Question:** Can every user workflow complete correctly under loading, error, empty, null, duplicate, and StrictMode double-render conditions?

```bash
cd /workspace/swing_screener/web-ui
rg -n "useEffect|useCallback|useMemo|useRef|useQuery|useMutation|enabled:|onSuccess|onError|onSettled" src/pages src/components src/features src/stores src/hooks
```

For each high-risk workflow, write a one-paragraph reproduction note before filing a finding: initial route/state, mocked API response, user action, expected result, observed result.

### 2. API-Boundary Contract

**Question:** Does every snake_case API response/request transform map every current backend field exactly once to the camelCase UI type, with nullable backend fields typed as `T | null` rather than silently omitted or widened?

```bash
cd /workspace/swing_screener
rg -n "export function transform|function transform|export const transform|interface .*API|type .*API|ResponseAPI|RequestAPI|: any|unknown as" web-ui/src/types web-ui/src/features web-ui/src/lib
rg -n "class .*\\(BaseModel\\)|response_model=|@router\\.(get|post|put|patch|delete)" api/models api/routers src/swing_screener/intelligence src/swing_screener/recommendation
```

Each contract finding must cite the backend source field line and the frontend API type/transform line.

### 3. State Management

**Question:** Is server state owned by React Query, UI/client state owned by Zustand, and cache invalidation/staleness complete without duplicated or stale server data?

```bash
cd /workspace/swing_screener/web-ui
rg -n "queryKey:|invalidateQueries|setQueryData|removeQueries|staleTime|gcTime|use[A-Za-z]+Store\\(" src/features src/components src/pages src/stores src/lib
```

Build a mutation-to-cache table with columns: mutation hook, affected endpoint, invalidated keys, missing keys, reproduction.

### 4. i18n Compliance

**Question:** Does every user-facing component string and test assertion source copy through `t(...)`, with valid `MessageKey` coverage and safe dynamic-key casts?

```bash
cd /workspace/swing_screener/web-ui
rg -n ">([^<{]*[A-Za-z][^<{]*)<|aria-label=\\\"|title=\\\"|placeholder=\\\"|getByText\\(|findByText\\(|queryByText\\(|toHaveTextContent\\(|getByRole\\([^\\n]*(name: ['\\\"]|name: /)|as any|as never" src --glob '!src/i18n/messages.en.ts'
rg -n "t\\(`|t\\([^'\\\"]|as MessageKey|as any|as never" src
```

Classify each candidate as user-facing copy, backend fixture, enum data, ticker/value, or test-only helper. File only user-facing/test assertion violations.

### 5. Type Safety

**Question:** Does strict TypeScript actually protect the code, or are `any`, `as never`, broad assertions, and non-exhaustive unions masking real defects?

```bash
cd /workspace/swing_screener/web-ui
rg -n "\\bany\\b|unknown as|as never|@ts-expect-error|@ts-ignore|!\\.|\\)!" src --glob '*.ts' --glob '*.tsx'
npm run typecheck
```

For every union-rendering helper, note whether a new union member would fail compilation, fall into a safe default, or silently render the wrong state.

### 6. Component Architecture

**Question:** Do files respect the documented feature/component boundaries, stay small enough to reason about, and keep reusable logic in the right layer?

```bash
cd /workspace/swing_screener
for d in web-ui/src/features/*; do [ -d "$d" ] || continue; printf '%s:' "${d#web-ui/src/features/}"; for f in api.ts hooks.ts types.ts; do [ -f "$d/$f" ] && printf ' %s' "$f" || printf ' -%s' "$f"; done; printf '\n'; done
cd /workspace/swing_screener/web-ui
rg -n "from ['\\\"]@/(features|components/domain|components/common|pages|stores)/" src --glob '*.ts' --glob '*.tsx'
cd /workspace/swing_screener
wc -l $(find web-ui/src -type f \( -name '*.ts' -o -name '*.tsx' \) | sort) | sort -nr | sed -n '1,80p'
```

Architecture findings need a quoted doc rule plus concrete impact. Line count alone is not enough.

### 7. Accessibility

**Question:** Can keyboard and assistive-technology users understand and operate every workflow, including charts and modal/tab transitions?

```bash
cd /workspace/swing_screener/web-ui
rg -n "role=|aria-|tabIndex|autoFocus|onKeyDown|<button|<input|<select|<textarea|<table|<canvas|createPortal" src/components src/pages
```

For every modal/tab/chart issue, write a keyboard script: start focused element, keys pressed, expected focus/announcement, observed focus/announcement.

### 8. Performance

**Question:** Are hot UI paths avoiding unnecessary renders, heavy render-time work, chart object churn, and avoidable bundle weight?

```bash
cd /workspace/swing_screener/web-ui
rg -n "\\.map\\(|\\.filter\\(|\\.sort\\(|new Set|new Map|reduce\\(|createChart|addSeries|createPriceLine|createSeriesMarkers|useScreenerStore\\(" src/components src/pages src/features src/stores
npm run build
du -h dist/assets/* | sort -hr | sed -n '1,30p'
```

Performance findings need measured proof: React Profiler result, mocked `lightweight-charts` call counts, before/after render-count reproduction in scratch, or Vite build output showing material chunk weight.

### 9. Test Coverage & Quality

**Question:** Do tests enforce behavior at the documented coverage gate without hardcoded copy, implementation-detail assertions, or happy-path-only MSW coverage?

```bash
cd /workspace/swing_screener/web-ui
npm run test:coverage
rg -n "render\\(|renderWithProviders|screen\\.getByTestId|data-testid|vi\\.mock|as never|getByText\\(|findByText\\(|queryByText\\(" src --glob '*.test.ts' --glob '*.test.tsx'
find src -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' |
  while read -r f; do
    stem="${f%.*}"
    [ -f "$stem.test.ts" ] || [ -f "$stem.test.tsx" ] || echo "$f"
  done
```

Test findings need coverage output, file-without-test inventory plus concrete risk path, or a test-quality example where implementation can break user behavior while the test still passes.

### 10. Consistency With CLAUDE.md + Web UI Docs

**Question:** Where does the frontend violate explicit repo/web-ui rules, and which doc claims have drifted from actual code?

```bash
cd /workspace/swing_screener
nl -ba CLAUDE.md | sed -n '1,220p'
nl -ba web-ui/docs/WEB_UI_ARCHITECTURE.md
nl -ba web-ui/docs/WEB_UI_GUIDE.md
nl -ba web-ui/eslint.config.mjs
```

Every convention finding must include a quote from the exact rule and one violating file:line. No quote, no convention finding.

## Verification

Run these from `web-ui/` and cite real output in final review notes:

```bash
cd /workspace/swing_screener/web-ui
npm test
npm run typecheck
npm run lint
npm run test:coverage
```

If `npm test` enters watch mode locally, stop it, rerun `npm test -- --run`, and record that behavior. Do not replace the requested command silently.

Optional for performance evidence:

```bash
cd /workspace/swing_screener/web-ui
npm run build
du -h dist/assets/* | sort -hr | sed -n '1,30p'
```

## Findings Format

Rank findings most severe first. Use this exact shape:

```text
Severity: critical | high | medium | low
Class: correctness | contract | a11y | perf | test-gap | convention
Location: web-ui/src/path/file.tsx:123
Defect: one-line defect statement
Scenario: concrete user/API/test scenario that fails or misleads
Proof: failing command output, reproduction steps, or quoted rule/spec citation
Fix class: targeted fix category, not full implementation
```

Severity ordering: correctness > contract > a11y > perf/cleanup > convention. Escalate convention only when it causes real defects or blocks future review. Demote broad cleanup with no failure scenario.

## Non-Goal

This review pass produces findings and recommendations only. Do not edit application code, tests, configs, package files, docs, snapshots, or generated output as part of the review itself. Temporary local repro tests are allowed only if removed before final delivery and cited as snippets/output in the findings.

## Execution Checklist

- [ ] Complete source map and doc-drift revalidation.
- [ ] Dispatch independent reviewers for Work Items 1-9 where available.
- [ ] Run Work Item 10 after candidate findings exist.
- [ ] Run verification commands from `web-ui/`.
- [ ] Merge duplicate findings across dimensions.
- [ ] Rank by severity and proof strength.
- [ ] Deliver findings only; no code changes.

## Unresolved Questions

- Backend source of truth: OpenAPI from running server or `api/models` + routers enough?
- Convention findings: include doc drift only, or only doc drift with implementation risk?
- A11y tooling: manual RTL/keyboard enough, or install axe not allowed?
- Persisted screener result intentional exception to no-local-persistence rule?
