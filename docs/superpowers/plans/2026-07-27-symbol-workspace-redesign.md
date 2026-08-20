# Symbol Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Today-page symbol canvas into a decision-first workspace whose data freshness, provenance, request progress, degraded inputs, and failures are visible and testable.

**Architecture:** Keep React Query as the owner of server state and Zustand as the owner of selection/layout state. Add a symbol-scoped workspace session and a pure health aggregation layer above existing queries, then split the current monolithic `SymbolAnalysisContent` into focused header, status, Overview, Fundamentals, News & Intelligence, action, and Volume Zones components. Reuse the existing intelligence `data_status`, `data_provenance`, `degraded_reasons`, and trace contracts; extend enrichment diagnostics only so fail-soft provider errors are returned to the UI instead of existing only in logs.

**Tech Stack:** React 18, TypeScript, Zustand, TanStack React Query, Vitest, React Testing Library, MSW, FastAPI, Pydantic, pytest, Tailwind CSS

## Global Constraints

- Preserve deterministic, risk-first, end-of-day behavior and manual execution.
- Preserve R-multiple position sizing and the server-authoritative candidate workflow state.
- Preview endpoints remain read-only and must not persist stops, orders, or portfolio state.
- Backend payloads remain `snake_case`; transform to `camelCase` only at the frontend API boundary.
- All user-facing strings use `web-ui/src/i18n/`; tests read the same i18n keys.
- Configurable behavior belongs in YAML; do not introduce UI freshness heuristics or hardcoded operator-tunable timeouts.
- Existing Backtest behavior and UI remain unchanged except for regression coverage.
- Do not automatically make paid/external intelligence calls on symbol selection or generic source refresh.
- Preserve unrelated work in the current worktree.

---

## File structure

### New frontend files

- `web-ui/src/features/workspaceData/types.ts` — normalized source-state and aggregate-health contracts.
- `web-ui/src/features/workspaceData/health.ts` — pure freshness, aggregation, and intelligence-outdated functions.
- `web-ui/src/features/workspaceData/health.test.ts` — state-matrix tests.
- `web-ui/src/features/workspaceData/useSymbolWorkspaceData.ts` — composes existing queries into one symbol-scoped read model.
- `web-ui/src/features/workspaceData/useSymbolWorkspaceData.test.tsx` — cache, invalidation, and cross-symbol race tests.
- `web-ui/src/components/domain/workspace/SymbolWorkspaceHeader.tsx` — sticky identity, health, refresh, layout controls.
- `web-ui/src/components/domain/workspace/SymbolWorkspaceHeader.test.tsx` — header behavior and accessibility.
- `web-ui/src/components/domain/workspace/DataStatusBar.tsx` — per-domain source, time, freshness, and retry controls.
- `web-ui/src/components/domain/workspace/DataStatusBar.test.tsx` — source-state rendering tests.
- `web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.tsx` — persistent request history and failures.
- `web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.test.tsx` — request lifecycle tests.
- `web-ui/src/components/domain/workspace/SymbolOverviewTab.tsx` — decision-first Overview.
- `web-ui/src/components/domain/workspace/SymbolOverviewTab.test.tsx` — Overview hierarchy and partial states.
- `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.tsx` — canonical fundamentals summary, trends, and metric table.
- `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.test.tsx` — freshness, missing, and refresh tests.
- `web-ui/src/components/domain/workspace/SymbolIntelligenceTab.tsx` — guided News & Intelligence flow.
- `web-ui/src/components/domain/workspace/SymbolIntelligenceTab.test.tsx` — input manifest, pipeline, and degraded-result tests.

### Existing frontend files to modify

- `web-ui/src/pages/Today.tsx` — expanded/collapsed layout and symbol rail.
- `web-ui/src/pages/Today.test.tsx` — layout preservation and close/full-screen behavior.
- `web-ui/src/stores/workspaceStore.ts` — layout mode, selection version, and activity state.
- `web-ui/src/stores/workspaceStore.test.ts` — state transition tests.
- `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx` — workspace composition and canonical query ownership.
- `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.test.tsx` — workspace integration tests.
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` — tab shell only; delegate tab bodies.
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx` — tab visibility and regression tests.
- `web-ui/src/components/domain/workspace/ActionPanel.tsx` — explicit candidate/position state and persistent mutation errors.
- `web-ui/src/components/domain/workspace/ActionPanel.test.tsx` — action-state and failed-submit tests.
- `web-ui/src/components/domain/workspace/VolumeZonesTab.tsx` — independent OHLCV/analysis states and identity validation.
- `web-ui/src/components/domain/workspace/VolumeZonesTab.test.tsx` — partial, wrong-symbol, and retry tests.
- `web-ui/src/components/domain/fundamentals/FundamentalsSnapshotCard.tsx` — use the new decision-first layout or reduce to reusable detail sections.
- `web-ui/src/features/fundamentals/hooks.ts` — canonical key and refresh cache write.
- `web-ui/src/features/fundamentals/hooks.test.tsx` — refresh/invalidation tests.
- `web-ui/src/features/intelligence/hooks.ts` — canonical query keys and explicit cache updates.
- `web-ui/src/features/intelligence/types.ts` — enrichment diagnostic transform.
- `web-ui/src/features/intelligence/types.test.ts` — diagnostic transform tests.
- `web-ui/src/features/volumeZones/types.ts` — expose/validate response ticker if missing.
- `web-ui/src/features/volumeZones/types.test.ts` — identity transform tests.
- `web-ui/src/lib/queryKeys.ts` — intelligence keys and prefix helpers.
- `web-ui/src/test/mocks/handlers.ts` — deterministic fresh/stale/partial/failure/delay fixtures.
- `web-ui/src/i18n/en.ts` and other locale modules following the existing i18n layout — all new copy.

### Backend files to modify

- `src/swing_screener/intelligence/models.py` — structured `EnrichmentDiagnostic` on the request/result input manifest.
- `api/services/intelligence_enrichment.py` — append success, missing, and fail-soft diagnostic entries.
- `src/swing_screener/intelligence/graph/nodes.py` — copy diagnostics into `inputs_used`.
- `tests/test_intelligence_enrichment.py` — provider-specific degraded-state tests.
- `tests/intelligence/test_symbol_analyzer.py` — persisted input-manifest tests.
- `tests/test_intelligence_router_enrichment.py` — endpoint response contract tests.
- `api/README.md` — document the additive intelligence diagnostics.
- `src/swing_screener/intelligence/README.md` — document UI-visible degraded inputs and flow.

### Delivery documentation

- `web-ui/docs/WEB_UI_GUIDE.md` — expanded workspace, tabs, and data-health behavior.
- `web-ui/docs/WEB_UI_ARCHITECTURE.md` — workspace session and server/UI state boundary.
- `CHANGELOG.md` — user-facing workspace redesign under `Unreleased`.
- session scratchpad `prs.md` — compare URL, imperative title, description, and screenshots section.

---

### Task 1: Establish symbol workspace session and health contracts

**Files:**

- Create: `web-ui/src/features/workspaceData/types.ts`
- Create: `web-ui/src/features/workspaceData/health.ts`
- Create: `web-ui/src/features/workspaceData/health.test.ts`
- Modify: `web-ui/src/stores/workspaceStore.ts`
- Modify: `web-ui/src/stores/workspaceStore.test.ts`

**Interfaces:**

- Produces:
  - `WorkspaceSourceId = 'screener' | 'prices' | 'fundamentals' | 'evidence' | 'intelligence' | 'positionOrders'`
  - `WorkspaceSourcePhase = 'idle' | 'loading' | 'fresh' | 'cached' | 'stale' | 'partial' | 'failed'`
  - `WorkspaceSourceState`
  - `WorkspaceHealth = 'fresh' | 'mixed' | 'stale' | 'partial' | 'failed'`
  - `aggregateWorkspaceHealth(states): WorkspaceHealth`
  - `isIntelligenceOutdated(intelligenceGeneratedAt, dependencies): boolean`
  - store fields `workspaceMode`, `selectionVersion`, `activityDrawerOpen`, `fullscreen`
- Consumes: server-provided timestamps/status only; no wall-clock freshness policy is introduced here.

- [ ] **Step 1: Write failing health and store tests**

```ts
it.each([
  [['fresh', 'fresh'], 'fresh'],
  [['fresh', 'cached'], 'mixed'],
  [['fresh', 'stale'], 'stale'],
  [['fresh', 'partial'], 'partial'],
  [['fresh', 'failed'], 'partial'],
  [['failed', 'failed'], 'failed'],
] as const)('aggregates %j as %s', (phases, expected) => {
  const states = phases.map((phase, index) =>
    sourceState(index === 0 ? 'screener' : 'fundamentals', phase),
  );
  expect(aggregateWorkspaceHealth(states)).toBe(expected);
});

it('increments the selection version and expands on a new ticker', () => {
  useWorkspaceStore.getState().setSelectedTicker('aapl', 'screener');
  const first = useWorkspaceStore.getState();
  expect(first.workspaceMode).toBe('expanded');
  expect(first.selectionVersion).toBe(1);

  useWorkspaceStore.getState().setSelectedTicker('msft', 'screener');
  expect(useWorkspaceStore.getState().selectionVersion).toBe(2);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/features/workspaceData/health.test.ts src/stores/workspaceStore.test.ts
```

Expected: FAIL because the contracts and new store fields do not exist.

- [ ] **Step 3: Implement the pure contracts and store transitions**

```ts
export interface WorkspaceSourceState {
  id: WorkspaceSourceId;
  ticker: string;
  selectionVersion: number;
  phase: WorkspaceSourcePhase;
  provider: string | null;
  dataAsOf: string | null;
  fetchedAt: string | null;
  cacheOrigin: 'network' | 'memory' | 'disk' | null;
  missingInputs: string[];
  error: { message: string; retryable: boolean } | null;
}

export function aggregateWorkspaceHealth(states: WorkspaceSourceState[]): WorkspaceHealth {
  const active = states.filter((state) => state.phase !== 'idle');
  if (active.length > 0 && active.every((state) => state.phase === 'failed')) return 'failed';
  if (active.some((state) => state.phase === 'partial' || state.phase === 'failed')) return 'partial';
  if (active.some((state) => state.phase === 'stale')) return 'stale';
  if (active.some((state) => state.phase === 'cached' || state.phase === 'loading')) return 'mixed';
  return 'fresh';
}
```

Store behavior:

- selecting a new non-null ticker increments `selectionVersion` and expands;
- selecting the same ticker does not increment the version;
- closing clears the ticker and returns to `split`;
- collapse changes `expanded` to `split` without clearing selection;
- full-screen is explicit UI state and resets when the workspace closes;
- existing `analysisTab` behavior remains intact.

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
cd web-ui
npx vitest run src/features/workspaceData/health.test.ts src/stores/workspaceStore.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/features/workspaceData web-ui/src/stores/workspaceStore.ts web-ui/src/stores/workspaceStore.test.ts
git commit -m "feat: model symbol workspace health"
```

---

### Task 2: Canonicalize workspace queries and refresh semantics

**Files:**

- Create: `web-ui/src/features/workspaceData/useSymbolWorkspaceData.ts`
- Create: `web-ui/src/features/workspaceData/useSymbolWorkspaceData.test.tsx`
- Modify: `web-ui/src/features/fundamentals/hooks.ts`
- Modify: `web-ui/src/features/fundamentals/hooks.test.tsx`
- Modify: `web-ui/src/features/intelligence/hooks.ts`
- Modify: `web-ui/src/lib/queryKeys.ts`
- Modify: `web-ui/src/test/mocks/handlers.ts`

**Interfaces:**

- Consumes: selected ticker/version, candidate, position, existing fundamentals/intelligence/candle hooks.
- Produces:
  - `queryKeys.intelligence.latest(ticker)`
  - `queryKeys.intelligence.history(ticker)`
  - `queryKeys.intelligence.chat(ticker, generatedAt)`
  - `useSymbolWorkspaceData({ ticker, selectionVersion, candidate, position })`
  - `refreshSource(sourceId): Promise<void>`
  - `refreshAllNonIntelligence(): Promise<void>`
  - source states for the header/status bar.

- [ ] **Step 1: Write failing cache and race tests**

```tsx
it('writes a refreshed fundamentals response into the canonical non-refresh key', async () => {
  const wrapper = createQueryWrapper();
  const { result } = renderHook(() => useRefreshFundamentalSnapshotMutation(), { wrapper });
  await act(() => result.current.mutateAsync('AAPL'));

  expect(queryClient.getQueryData(queryKeys.fundamentalsSnapshot('AAPL'))).toMatchObject({
    symbol: 'AAPL',
  });
});

it('does not expose an AAPL completion in an MSFT workspace session', async () => {
  server.use(delayedFundamentals('AAPL', 200), delayedFundamentals('MSFT', 10));
  const { result, rerender } = renderWorkspaceHook('AAPL', 1);
  rerender({ ticker: 'MSFT', selectionVersion: 2 });
  await waitFor(() => expect(result.current.ticker).toBe('MSFT'));
  expect(result.current.fundamentals.data?.symbol).not.toBe('AAPL');
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/features/fundamentals/hooks.test.tsx src/features/workspaceData/useSymbolWorkspaceData.test.tsx
```

Expected: FAIL because refresh currently invalidates rather than writing one canonical snapshot and no workspace hook exists.

- [ ] **Step 3: Implement canonical query ownership**

Use one fundamentals key, `queryKeys.fundamentalsSnapshot(symbol)`. Do not encode
`refresh=true` in the cache identity. The refresh mutation fetches with the
refresh transport parameter and then writes:

```ts
queryClient.setQueryData(
  queryKeys.fundamentalsSnapshot(snapshot.symbol.trim().toUpperCase()),
  snapshot,
);
```

Move intelligence keys from inline arrays into `queryKeys.intelligence`.
`useSymbolWorkspaceData` derives display state but never copies query data into
Zustand. It validates transformed `symbol`/`ticker` fields before exposing data.
`refreshAllNonIntelligence` refetches fundamentals and OHLCV and invalidates
position/orders; it does not call `useIntelligenceAnalysisMutation`.

- [ ] **Step 4: Run tests, lint, and typecheck**

Run:

```bash
cd web-ui
npx vitest run src/features/fundamentals src/features/intelligence src/features/workspaceData
npm run typecheck
npm run lint
```

Expected: PASS with zero lint warnings.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/features/workspaceData web-ui/src/features/fundamentals web-ui/src/features/intelligence/hooks.ts web-ui/src/lib/queryKeys.ts web-ui/src/test/mocks/handlers.ts
git commit -m "fix: unify symbol workspace cache state"
```

---

### Task 3: Build the expandable Today workspace shell

**Files:**

- Create: `web-ui/src/components/domain/workspace/SymbolWorkspaceHeader.tsx`
- Create: `web-ui/src/components/domain/workspace/SymbolWorkspaceHeader.test.tsx`
- Create: `web-ui/src/components/domain/workspace/DataStatusBar.tsx`
- Create: `web-ui/src/components/domain/workspace/DataStatusBar.test.tsx`
- Create: `web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.tsx`
- Create: `web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.test.tsx`
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/pages/Today.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.test.tsx`
- Modify: `web-ui/src/i18n/`

**Interfaces:**

- Consumes: workspace store layout/session fields and `useSymbolWorkspaceData`.
- Produces: expanded rail/workspace layout, sticky header, source status bar,
  activity drawer, close/collapse/full-screen controls.

- [ ] **Step 1: Write failing layout and accessibility tests**

```tsx
it('collapses the table to a symbol rail and restores its state on close', async () => {
  const { user } = renderWithProviders(<Today />);
  await user.click(screen.getByRole('button', { name: /AAPL/i }));
  expect(screen.getByTestId('symbol-rail')).toBeVisible();
  expect(screen.getByTestId('symbol-workspace')).toHaveAttribute('data-mode', 'expanded');

  await user.click(screen.getByRole('button', { name: t('workspacePage.controls.close') }));
  expect(screen.getByTestId('today-symbol-table')).toBeVisible();
  expect(screen.getByRole('tab', { name: t('todayPage.tabs.screener') })).toHaveAttribute('aria-selected', 'true');
});

it('announces a persistent source failure', () => {
  renderWithProviders(<WorkspaceActivityDrawer activities={[failedActivity]} />);
  expect(screen.getByRole('status')).toHaveTextContent(failedActivity.error.message);
  expect(screen.getByRole('button', { name: t('workspacePage.data.retry') })).toBeEnabled();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/pages/Today.test.tsx src/components/domain/workspace/SymbolWorkspaceHeader.test.tsx src/components/domain/workspace/DataStatusBar.test.tsx src/components/domain/workspace/WorkspaceActivityDrawer.test.tsx
```

Expected: FAIL because the workspace shell does not exist.

- [ ] **Step 3: Implement the responsive shell**

Use responsive CSS classes driven by `workspaceMode`:

- no selected ticker: existing `7/12 + 5/12` split;
- expanded: rail width `minmax(12rem, 18rem)` and workspace `minmax(0, 1fr)`;
- full-screen: hide rail without clearing selection;
- below the desktop breakpoint: stack the workspace and provide a back-to-list
  control rather than forcing a narrow rail.

The status bar displays the source label, phase, provider, and formatted
timestamp. The activity drawer retains failed activities until a successful
replacement or explicit dismissal. Loading state uses `aria-live="polite"`;
failures use `role="alert"` only when newly reported to avoid repeated
announcements.

- [ ] **Step 4: Run component suite, typecheck, and lint**

Run:

```bash
cd web-ui
npx vitest run src/pages/Today.test.tsx src/components/domain/workspace src/features/workspaceData
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/pages/Today.test.tsx web-ui/src/components/domain/workspace web-ui/src/i18n
git commit -m "feat: expand selected symbol workspace"
```

---

### Task 4: Replace the Overview card stack with a decision-first tab

**Files:**

- Create: `web-ui/src/components/domain/workspace/SymbolOverviewTab.tsx`
- Create: `web-ui/src/components/domain/workspace/SymbolOverviewTab.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisDecisionStrip.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisDecisionStrip.test.tsx`
- Modify: `web-ui/src/i18n/`

**Interfaces:**

- Consumes: canonical candidate workflow decision, position, fundamentals source
  state, intelligence-outdated flag, candles, and catalyst query state.
- Produces: one action recap, one trade-plan table, evidence balance, compact
  cross-tab summaries, chart, and explicit partial-data notice.

- [ ] **Step 1: Write failing hierarchy tests**

```tsx
it('renders one canonical action and groups the trade plan as a table', () => {
  renderWithProviders(<SymbolOverviewTab model={readyCandidateModel} />);
  expect(screen.getAllByText(t('decision.actions.buyNow'))).toHaveLength(1);
  expect(screen.getByRole('table', { name: t('workspacePage.overview.tradePlan') })).toBeVisible();
  expect(screen.getByRole('link', { name: t('workspacePage.overview.openFundamentals') })).toBeVisible();
});

it('shows available content and names a failed dependency', () => {
  renderWithProviders(<SymbolOverviewTab model={partialFundamentalsModel} />);
  expect(screen.getByText(t('workspacePage.data.partial'))).toBeVisible();
  expect(screen.getByText(/fundamentals/i)).toBeVisible();
  expect(screen.getByTestId('symbol-candle-chart')).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/components/domain/workspace/SymbolOverviewTab.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx
```

Expected: FAIL because Overview is still assembled inline from repeating cards.

- [ ] **Step 3: Implement Overview and reduce duplication**

Render in this order:

1. canonical workflow action and next step;
2. discursive `whatToDo`, `whyNow`, and `mainRisk`;
3. table rows for entry, stop, target, risk/reward, and invalidation;
4. at most three supports and three opposing signals;
5. compact fundamentals/catalyst summaries with timestamp and open-tab action;
6. held-position summary where applicable;
7. chart and technical details.

Keep `AnalysisDecisionStrip` as the single top-level decision component or fold
its behavior into `SymbolOverviewTab`; do not render it above every tab. Preserve
watch/unwatch and prepare-order actions in the workspace header or Overview.

- [ ] **Step 4: Run tests and lint**

Run:

```bash
cd web-ui
npx vitest run src/components/domain/workspace/SymbolOverviewTab.test.tsx src/components/domain/workspace/AnalysisDecisionStrip.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace web-ui/src/i18n
git commit -m "feat: clarify symbol decision overview"
```

---

### Task 5: Make Fundamentals canonical and decision-first

**Files:**

- Create: `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.tsx`
- Create: `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.test.tsx`
- Modify: `web-ui/src/components/domain/fundamentals/FundamentalsSnapshotCard.tsx`
- Modify: matching fundamentals component tests
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx`
- Modify: `web-ui/src/i18n/`

**Interfaces:**

- Consumes: the single `queryKeys.fundamentalsSnapshot(ticker)` query owned by
  `useSymbolWorkspaceData`.
- Produces: decision impact, supports/concerns/quality, provenance, trend table,
  full metric table, missing-metric summary, and scoped refresh.

- [ ] **Step 1: Write failing stale/missing/refresh tests**

```tsx
it('shows a stale snapshot with its original timestamp while refreshing', async () => {
  const { user } = renderWithProviders(<SymbolFundamentalsTab model={staleRefreshingModel} />);
  expect(screen.getByText(t('workspacePage.data.stale'))).toBeVisible();
  expect(screen.getByText(formatDateTime(staleSnapshot.updatedAt))).toBeVisible();
  expect(screen.getByText(t('workspacePage.data.refreshing'))).toBeVisible();
  expect(screen.getByText(staleSnapshot.companyName!)).toBeVisible();
  await user.click(screen.getByRole('button', { name: t('workspacePage.data.showActivity') }));
});

it('groups unavailable metrics instead of rendering repeated n/a cards', () => {
  renderWithProviders(<SymbolFundamentalsTab model={sparseModel} />);
  expect(screen.getByText(t('workspacePage.fundamentals.unavailableCount', { count: 6 }))).toBeVisible();
  expect(screen.queryAllByText('n/a').length).toBeLessThan(3);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/components/domain/workspace/SymbolFundamentalsTab.test.tsx src/components/domain/fundamentals
```

Expected: FAIL because the current card renders a metric inventory and the query
is separately owned by both canvas components.

- [ ] **Step 3: Implement the canonical Fundamentals presentation**

Remove the duplicate fundamentals query from `AnalysisCanvasPanel` or
`SymbolAnalysisContent`; the composed workspace model owns it once. Stop
patching the current screener candidate to make its historical decision appear
current. Label candidate fundamentals as “used by screener run at …” when shown
for comparison.

The refresh success path writes the canonical query immediately. Compare
`snapshot.updatedAt` with `intelligence.generatedAt`; if newer, display
**Intelligence is based on older inputs** without automatically regenerating it.

- [ ] **Step 4: Run focused and integration tests**

Run:

```bash
cd web-ui
npx vitest run src/features/fundamentals src/components/domain/fundamentals src/components/domain/workspace/SymbolFundamentalsTab.test.tsx src/components/domain/workspace/AnalysisCanvasPanel.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/fundamentals web-ui/src/components/domain/workspace web-ui/src/features/fundamentals web-ui/src/i18n
git commit -m "fix: present one fundamentals snapshot"
```

---

### Task 6: Surface fail-soft intelligence enrichment diagnostics

**Files:**

- Modify: `src/swing_screener/intelligence/models.py`
- Modify: `api/services/intelligence_enrichment.py`
- Modify: `src/swing_screener/intelligence/graph/nodes.py`
- Modify: `tests/test_intelligence_enrichment.py`
- Modify: `tests/intelligence/test_symbol_analyzer.py`
- Modify: `tests/test_intelligence_router_enrichment.py`
- Modify: `web-ui/src/features/intelligence/types.ts`
- Modify: `web-ui/src/features/intelligence/types.test.ts`
- Modify: `api/README.md`
- Modify: `src/swing_screener/intelligence/README.md`

**Interfaces:**

- Produces additive `inputs_used.enrichment_diagnostics` entries:

```python
class EnrichmentDiagnostic(BaseModel):
    source: Literal["fundamentals", "earnings", "dividend", "evidence", "technicals", "polygon_prices"]
    status: Literal["used", "missing", "failed"]
    as_of: str | None = None
    item_count: int | None = None
    message: str | None = None
```

- Frontend produces `EnrichmentDiagnostic` with camelCase `itemCount` and
  validates default `[]` for old caches.

- [ ] **Step 1: Write failing provider-diagnostic tests**

```python
def test_enricher_records_fundamentals_failure_without_failing_analysis():
    request = _request()
    out = enrich_intelligence_request("AAPL", request, fundamentals=_Boom())
    assert out.enrichment_diagnostics == [
        EnrichmentDiagnostic(
            source="fundamentals",
            status="failed",
            message="Fundamentals provider failed.",
        )
    ]

def test_inputs_used_exposes_enrichment_diagnostics(analyzer):
    result = analyzer.analyze("AAPL", _request_with_diagnostics())
    assert result.inputs_used["enrichment_diagnostics"][0]["source"] == "evidence"
    assert result.inputs_used["enrichment_diagnostics"][0]["status"] == "missing"
```

- [ ] **Step 2: Run backend tests and verify failure**

Run:

```bash
pytest tests/test_intelligence_enrichment.py tests/intelligence/test_symbol_analyzer.py tests/test_intelligence_router_enrichment.py -q
```

Expected: FAIL because fail-soft exceptions currently only log warnings.

- [ ] **Step 3: Implement sanitized structured diagnostics**

Append one diagnostic for every attempted source. Do not return raw exception
strings, URLs containing credentials, or provider payloads. Keep detailed
exceptions in logs/traces; return stable user-safe messages such as
`"Fundamentals provider failed."`. Copy diagnostics into `inputs_used` during
`assemble_inputs`. Old cached results without diagnostics remain valid.

Transform the additive field at the frontend boundary:

```ts
export interface EnrichmentDiagnostic {
  source: EnrichmentSource;
  status: 'used' | 'missing' | 'failed';
  asOf: string | null;
  itemCount: number | null;
  message: string | null;
}
```

- [ ] **Step 4: Run backend/frontend contract verification**

Run:

```bash
pytest tests/test_intelligence_enrichment.py tests/intelligence/test_symbol_analyzer.py tests/test_intelligence_router_enrichment.py -q
cd web-ui
npx vitest run src/features/intelligence/types.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/intelligence api/services/intelligence_enrichment.py tests/test_intelligence_enrichment.py tests/intelligence/test_symbol_analyzer.py tests/test_intelligence_router_enrichment.py web-ui/src/features/intelligence api/README.md
git commit -m "feat: expose intelligence input failures"
```

---

### Task 7: Redesign News & Intelligence as a guided flow

**Files:**

- Create: `web-ui/src/components/domain/workspace/SymbolIntelligenceTab.tsx`
- Create: `web-ui/src/components/domain/workspace/SymbolIntelligenceTab.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- Modify: `web-ui/src/components/domain/workspace/PositionReviewPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/StrategicReviewPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/IntelligenceChatPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx`
- Modify: matching component tests
- Modify: `web-ui/src/features/intelligence/hooks.ts`
- Modify: `web-ui/src/i18n/`

**Interfaces:**

- Consumes: current source manifest, intelligence latest query, explicit
  analysis mutation, diagnostics, run trace, position/strategic/chat mutations.
- Produces: staged input review, explicit source refresh/generation controls,
  pipeline status, discursive recap, evidence table, optional follow-ups, and
  technical detail disclosure.

- [ ] **Step 1: Write failing guided-flow tests**

```tsx
it('requires an explicit generation action and shows the input manifest first', () => {
  renderWithProviders(<SymbolIntelligenceTab model={noAnalysisModel} />);
  expect(screen.getByRole('table', { name: t('workspacePage.intelligence.inputs.title') })).toBeVisible();
  expect(screen.getByText(t('workspacePage.intelligence.sources.fundamentals'))).toBeVisible();
  expect(mockAnalyze).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: t('workspacePage.intelligence.generate') })).toBeEnabled();
});

it('shows the failed pipeline step and keeps completed inputs visible', () => {
  renderWithProviders(<SymbolIntelligenceTab model={formatFailureModel} />);
  expect(screen.getByText(t('workspacePage.intelligence.steps.formatting'))).toHaveAttribute('data-status', 'failed');
  expect(screen.getByText(t('workspacePage.intelligence.steps.enriching'))).toHaveAttribute('data-status', 'complete');
  expect(screen.getByRole('button', { name: t('workspacePage.data.retry') })).toBeEnabled();
});

it('marks analysis outdated when a dependency is newer', () => {
  renderWithProviders(<SymbolIntelligenceTab model={outdatedAnalysisModel} />);
  expect(screen.getByText(t('workspacePage.intelligence.outdated'))).toBeVisible();
  expect(screen.getByText(oldAnalysis.summaryLine)).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/components/domain/workspace/SymbolIntelligenceTab.test.tsx src/components/domain/workspace/PositionReviewPanel.test.tsx src/components/domain/workspace/StrategicReviewPanel.test.tsx src/components/domain/workspace/IntelligenceChatPanel.test.tsx
```

Expected: FAIL because the existing tab presents multiple independent panels
without an ordered input/generation flow.

- [ ] **Step 3: Implement the guided information architecture**

Render:

1. **Inputs and sources** table with source, provider, as-of, cache state, item
   count, and failure;
2. separate **Refresh evidence sources** and **Generate analysis** controls;
3. pipeline steps derived from the active mutation and run trace;
4. current/cached/outdated/partial result label;
5. discursive recap followed by a structured evidence table;
6. collapsed optional actions: position review, market-context review, chat;
7. collapsed history and technical trace.

Do not remove existing advisory capabilities. Rename and reorder them. Reset
mutation-local state on ticker/version changes and ignore results whose returned
symbol does not match the current normalized ticker.

- [ ] **Step 4: Run intelligence component and integration tests**

Run:

```bash
cd web-ui
npx vitest run src/features/intelligence src/components/domain/workspace/SymbolIntelligenceTab.test.tsx src/components/domain/workspace/PositionReviewPanel.test.tsx src/components/domain/workspace/StrategicReviewPanel.test.tsx src/components/domain/workspace/IntelligenceChatPanel.test.tsx src/components/domain/workspace/NarrativeAnalysisCard.test.tsx src/components/domain/workspace/AnalysisCanvasPanel.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace web-ui/src/features/intelligence web-ui/src/i18n
git commit -m "feat: guide news and intelligence review"
```

---

### Task 8: Clarify candidate/position actions and failure recovery

**Files:**

- Modify: `web-ui/src/components/domain/workspace/ActionPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/ActionPanel.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/ManagePositionPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/ManagePositionPanel.test.tsx`
- Modify: `web-ui/src/i18n/`

**Interfaces:**

- Consumes: canonical `workflowStatus`, position/add-on state, order mutation,
  position preview/mutations.
- Produces: state-specific tab label/content and recoverable mutation UI.

- [ ] **Step 1: Write failing action-state tests**

```tsx
it('explains why a non-ready candidate has no order form', () => {
  renderWithProviders(<ActionPanel ticker="AAPL" candidate={waitingCandidate} />);
  expect(screen.queryByRole('button', { name: t('orders.create') })).not.toBeInTheDocument();
  expect(screen.getByText(formatWorkflowNextStep(waitingCandidate.recommendation.nextStep))).toBeVisible();
});

it('preserves order values after a failed submit', async () => {
  server.use(failingCreateOrder());
  const { user } = renderWithProviders(<ActionPanel ticker="AAPL" candidate={readyCandidate} />);
  await user.clear(screen.getByLabelText(t('orders.fields.shares')));
  await user.type(screen.getByLabelText(t('orders.fields.shares')), '25');
  await user.click(screen.getByRole('button', { name: t('orders.create') }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByLabelText(t('orders.fields.shares'))).toHaveValue(25);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/components/domain/workspace/ActionPanel.test.tsx src/components/domain/workspace/ManagePositionPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx
```

Expected: at least the explicit blocked-state/persistent-error assertions fail.

- [ ] **Step 3: Implement mode-specific action presentation**

Use **Order** only for a canonical ready candidate or ready add-on. Use
**Position** for held symbols. When the candidate is not ready, keep the action
explanation accessible from Overview but do not render an enabled order form.
Keep advisory text above a visible boundary labeled as non-mutating; keep
preview and mutation buttons distinct. Persist form state until mutation
success or explicit cancel.

- [ ] **Step 4: Run action tests and regression suite**

Run:

```bash
cd web-ui
npx vitest run src/components/domain/orders src/components/domain/workspace/ActionPanel.test.tsx src/components/domain/workspace/ManagePositionPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace web-ui/src/components/domain/orders web-ui/src/i18n
git commit -m "fix: clarify symbol action states"
```

---

### Task 9: Make Volume Zones failures and identity explicit

**Files:**

- Modify: `web-ui/src/components/domain/workspace/VolumeZonesTab.tsx`
- Modify: `web-ui/src/components/domain/workspace/VolumeZonesTab.test.tsx`
- Modify: `web-ui/src/features/volumeZones/api.ts`
- Modify: `web-ui/src/features/volumeZones/hooks.ts`
- Modify: `web-ui/src/features/volumeZones/types.ts`
- Modify: `web-ui/src/features/volumeZones/types.test.ts`
- Modify: `web-ui/src/features/screener/hooks.ts`
- Modify: `web-ui/src/i18n/`

**Interfaces:**

- Consumes: ticker-keyed OHLCV and `(ticker, lookback, minRr)` analysis queries.
- Produces: independent source states, validated response identity, retry
  controls, decision-relevance summary, chart, zone table, and limitations.

- [ ] **Step 1: Write failing partial and wrong-symbol tests**

```tsx
it('shows zones when candle rendering fails and exposes the candle retry', async () => {
  server.use(successfulVolumeAnalysis('AAPL'), failingCandles('AAPL'));
  renderWithProviders(<VolumeZonesTab ticker="AAPL" />);
  expect(await screen.findByText(t('workspacePage.volumeZones.summary'))).toBeVisible();
  expect(screen.getByText(t('workspacePage.volumeZones.candlesFailed'))).toBeVisible();
  expect(screen.getByRole('button', { name: t('workspacePage.data.retryPrices') })).toBeEnabled();
});

it('rejects a response for another symbol', async () => {
  server.use(volumeAnalysisResponse({ ticker: 'MSFT' }));
  renderWithProviders(<VolumeZonesTab ticker="AAPL" />);
  expect(await screen.findByText(t('workspacePage.data.identityMismatch'))).toBeVisible();
  expect(screen.queryByTestId('volume-zone-chart')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd web-ui
npx vitest run src/features/volumeZones src/components/domain/workspace/VolumeZonesTab.test.tsx
```

Expected: FAIL because candle errors are not rendered independently and response
identity is not enforced in the tab.

- [ ] **Step 3: Implement independent state rendering and validation**

Validate the transformed analysis ticker against the normalized request ticker.
Show OHLCV provider/time and analysis parameters before the chart. Render the
analysis summary/table even if candles fail, but label the overall tab
`partial`. Add explicit retries using the canonical query keys. Preserve the
approximate bar-profile warning prominently.

- [ ] **Step 4: Run tests, typecheck, and lint**

Run:

```bash
cd web-ui
npx vitest run src/features/volumeZones src/features/screener src/components/domain/workspace/VolumeZonesTab.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/features/volumeZones web-ui/src/features/screener/hooks.ts web-ui/src/components/domain/workspace/VolumeZonesTab.tsx web-ui/src/components/domain/workspace/VolumeZonesTab.test.tsx web-ui/src/i18n
git commit -m "fix: expose volume-zone data failures"
```

---

### Task 10: Add full reliability matrix, accessibility, docs, and visual evidence

**Files:**

- Modify: `web-ui/src/test/mocks/handlers.ts`
- Modify: `web-ui/src/pages/Today.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.test.tsx`
- Modify: all in-scope tab tests as gaps require
- Modify: `web-ui/docs/WEB_UI_GUIDE.md`
- Modify: `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- Modify: `CHANGELOG.md`
- Create: `docs/screenshots/symbol-workspace-fresh.png`
- Create: `docs/screenshots/symbol-workspace-intelligence.png`
- Create: `docs/screenshots/symbol-workspace-stale-fundamentals.png`
- Create: `docs/screenshots/symbol-workspace-partial-intelligence.png`
- Create: `docs/screenshots/symbol-workspace-fullscreen.png`
- Create: `docs/screenshots/symbol-workspace-mobile.png`
- Create: session scratchpad `prs.md`

**Interfaces:**

- Consumes: completed workspace behavior.
- Produces: acceptance-level regression suite, screenshots, updated docs, and PR
  delivery text.

- [ ] **Step 1: Add the remaining acceptance tests**

Use parameterized fixtures for every in-scope tab:

```tsx
it.each([
  'no-data',
  'fresh',
  'cached',
  'stale',
  'refreshing-with-data',
  'partial',
  'failed',
  'timeout',
  'malformed',
] as const)('renders the %s workspace state without silent failure', async (fixture) => {
  server.use(...workspaceFixture(fixture));
  renderWithProviders(<Today />);
  await selectTicker('AAPL');
  await expectWorkspaceState(fixture);
});
```

Add explicit tests for:

- AAPL → MSFT with delayed AAPL completion;
- refresh during tab switch;
- unmount during intelligence generation;
- screener rerun leaving fundamentals/intelligence timestamps unchanged;
- focus returning to the selected table row after close;
- keyboard navigation through rail, tabs, header, status bar, and drawer;
- Backtest tab rendering and existing run/reset behavior unchanged.

- [ ] **Step 2: Run the complete backend and frontend suites**

Run:

```bash
pytest -q
cd web-ui
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0; lint has zero warnings.

- [ ] **Step 3: Perform browser verification and capture screenshots**

Start the app using the documented commands and capture:

1. expanded workspace with fresh data;
2. News & Intelligence input manifest and generated recap;
3. stale fundamentals during refresh;
4. partial intelligence with one failed source;
5. full-screen workspace;
6. mobile/back-to-list state if supported by the existing screenshot tooling.

Verify manually:

- table filters/sort/scroll/source tab survive open and close;
- no old ticker flashes during rapid switching;
- activity failures remain visible;
- focus order and status announcements are usable;
- Backtest is visually and behaviorally unchanged.

- [ ] **Step 4: Update documentation and changelog**

Document:

- expandable workspace and symbol rail;
- the four-layer information hierarchy;
- canonical fundamentals ownership;
- workspace session versus React Query ownership;
- explicit intelligence source/generation flow;
- per-source health and activity drawer;
- Backtest exclusion.

Add an `Unreleased` changelog entry describing the user-visible redesign and
reliability reporting.

- [ ] **Step 5: Write `prs.md`, verify diff, and commit**

Create `feat/symbol-workspace-redesign` from the current
`feat/coherent-execution-workflow` base so the compare URL is stable:

```text
https://github.com/matteolongo/swing_screener/compare/feat/coherent-execution-workflow...feat/symbol-workspace-redesign?expand=1

Expand the symbol analysis workspace

Collapse the Today table into a symbol rail and reorganize symbol analysis around the decision, evidence, and data trust.

Make source freshness, timestamps, degraded inputs, request progress, and failures visible across Overview, Fundamentals, News & Intelligence, actions, and Volume Zones. Keep Backtest unchanged.

## Screenshots

- Fresh expanded workspace: `docs/screenshots/symbol-workspace-fresh.png`
- News & Intelligence flow: `docs/screenshots/symbol-workspace-intelligence.png`
- Stale fundamentals refresh: `docs/screenshots/symbol-workspace-stale-fundamentals.png`
- Partial intelligence source failure: `docs/screenshots/symbol-workspace-partial-intelligence.png`
- Full-screen workspace: `docs/screenshots/symbol-workspace-fullscreen.png`
- Mobile workspace: `docs/screenshots/symbol-workspace-mobile.png`
```

Then run:

```bash
git diff --check
git status --short
git add web-ui/src/test web-ui/src/pages/Today.test.tsx web-ui/src/components/domain/workspace web-ui/docs/WEB_UI_GUIDE.md web-ui/docs/WEB_UI_ARCHITECTURE.md CHANGELOG.md
git commit -m "test: verify symbol workspace reliability"
```

Expected: only intended files are committed; pre-existing unrelated untracked
files remain untouched.

---

## Final verification checklist

- [ ] No request fails into an empty or unlabeled panel.
- [ ] No response renders for the wrong ticker or selection version.
- [ ] Every displayed dataset shows source and timestamp.
- [ ] Cached/stale content retains its original time during refresh.
- [ ] Screener refresh does not relabel other sources.
- [ ] Newer fundamentals marks intelligence outdated.
- [ ] Intelligence lists inputs used and failed/missing inputs.
- [ ] Evidence refresh and intelligence generation remain separate explicit actions.
- [ ] Candidate/order and position-management mutations remain manual.
- [ ] Failed mutations preserve form state.
- [ ] Volume Zones shows independent candle and analysis failures.
- [ ] Backtest behavior is unchanged.
- [ ] All user-facing strings use i18n keys.
- [ ] Backend and frontend suites, typecheck, lint, and build pass.
- [ ] Required UI screenshots are referenced in `prs.md`.
