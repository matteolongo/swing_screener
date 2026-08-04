# Symbol Workspace Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every actionable review finding from PR #435 while preserving manual execution and Backtest behavior.

**Architecture:** Keep server provenance and cache semantics authoritative, React Query as server-state owner, and Zustand as selection/layout/activity-history owner. Add strict response identity checks, compact variants of the existing mounted source panels, and a request-ID lifecycle model separate from current source health.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, pytest, React 18, TypeScript, Zustand, TanStack React Query, Vitest, React Testing Library, MSW, Tailwind CSS

## Global Constraints

- Stack on `feat/symbol-workspace-redesign` at `b392454ee39265bb419c3dd500f129f850087898`.
- Preserve deterministic, risk-first, end-of-day behavior and manual execution.
- Preview and refresh endpoints must not mutate positions, orders, stops, or trading state.
- Backend payloads remain `snake_case`; transform to `camelCase` only at the frontend API boundary.
- All user-facing copy uses `web-ui/src/i18n/messages.en.ts` and `t()`.
- React Query owns server state; Zustand owns selection, layout, and session activity history.
- Existing Backtest behavior and production code remain unchanged.
- Every behavioral production change requires a failing regression test first.

---

## File structure

### New frontend files

- `web-ui/src/components/domain/workspace/SymbolRailRow.tsx` — shared compact ticker/status row.
- `web-ui/src/components/domain/workspace/SymbolRailRow.test.tsx` — selection and accessibility contract.
- `web-ui/src/features/workspaceData/activity.ts` — pure request lifecycle helpers.
- `web-ui/src/features/workspaceData/activity.test.ts` — lifecycle transition and history-cap tests.

### Modified backend files

- `src/swing_screener/intelligence/evidence/collect.py` — UTC dates, atomic writes, refresh preservation/merge.
- `tests/test_evidence_collect.py` — cache preservation, partial merge, empty success, UTC/future-date tests.
- `api/routers/market_data.py` — structured volume-provider 502.
- `tests/api/test_volume_analysis_endpoint.py` — provider failure versus valid empty response.
- `api/README.md` and `src/swing_screener/intelligence/README.md` — updated contracts.

### Modified frontend files

- `web-ui/src/features/portfolio/api.ts` and `.test.ts` — omit `status=all`.
- `web-ui/src/features/intelligence/hooks.ts` and tests — typed latest-response identity check.
- `web-ui/src/features/workspaceData/useSymbolWorkspaceData.ts` and `.test.tsx` — authoritative provenance and staleness.
- `web-ui/src/features/workspaceData/types.ts` — activity types.
- `web-ui/src/stores/workspaceStore.ts` and `.test.ts` — bounded activity history actions.
- `web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.tsx` and `.test.tsx` — lifecycle display and one-time alert.
- `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx` and `.test.tsx` — activity composition.
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` and `.test.tsx` — intelligence activity callbacks/discards.
- `web-ui/src/components/domain/today/TodayActionList.tsx` — compact Today rail.
- `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx` — compact Screener rail.
- `web-ui/src/components/domain/watchlist/WatchlistPipelinePanel.tsx` — compact Watchlist rail.
- `web-ui/src/pages/Today.tsx` and `.test.tsx` — pass compact mode and preserve mounted state.
- `web-ui/src/i18n/messages.en.ts` — rail/activity labels.
- `web-ui/docs/WEB_UI_GUIDE.md` and `web-ui/docs/WEB_UI_ARCHITECTURE.md` — lifecycle/rail architecture.
- `docs/superpowers/specs/2026-07-28-workspace-status-truth-design.md` — remove trailing whitespace.

---

### Task 1: Preserve evidence caches and use UTC

**Files:**
- Modify: `tests/test_evidence_collect.py`
- Modify: `src/swing_screener/intelligence/evidence/collect.py`
- Modify: `src/swing_screener/intelligence/README.md`

**Interfaces:**
- Consumes: `collect_evidence(..., refresh_sources=True, attempt_callback=...)`.
- Produces: atomic `_write_cache(path, items)` and refresh merge semantics without changing the public return type.

- [ ] **Step 1: Write failing cache-preservation tests**

Add tests that seed `tmp_path / ASOF.isoformat() / "AAPL.json"`, then assert:

```python
def test_failed_refresh_preserves_existing_cache(tmp_path, monkeypatch):
    cache_file = tmp_path / ASOF.isoformat() / "AAPL.json"
    cache_file.parent.mkdir(parents=True)
    cache_file.write_text(json.dumps([_ev().model_dump()]))
    monkeypatch.setattr(
        SecEdgarCatalystCollector,
        "collect",
        classmethod(lambda cls, *args, **kwargs: (_ for _ in ()).throw(RuntimeError("down"))),
    )

    assert collect_evidence(
        "AAPL", asof_date=ASOF, cfg=CFG, cache_root=tmp_path,
        refresh_sources=True,
    ) == []
    assert json.loads(cache_file.read_text())[0]["publisher"] == "SEC EDGAR"
```

Add a two-provider test where one succeeds and one fails; assert successful-provider entries are replaced and failed-provider entries survive. Add a successful-empty-provider test asserting that provider's old entries are removed.

- [ ] **Step 2: Run the evidence tests and verify RED**

Run: `uv run pytest tests/test_evidence_collect.py -q`

Expected: the failed refresh test sees `[]` overwrite the seeded cache; the partial merge test loses failed-provider evidence.

- [ ] **Step 3: Implement outcome-aware atomic cache replacement**

Track successful and failed source IDs while collecting. Read the prior same-day cache before forced collection. If no source succeeds, skip `_write_cache`. Otherwise retain prior items whose provider/source belongs to failed attempts, combine with fresh items, curate, then write through a sibling temporary file and `Path.replace()`.

Use `datetime.now(timezone.utc).date()` instead of `date.today()`. In `read_latest_cached_evidence_summary`, treat `cache_age_days < 0` as stale and only `cache_age_days == 0` as fresh.

- [ ] **Step 4: Run focused backend tests and verify GREEN**

Run: `uv run pytest tests/test_evidence_collect.py tests/test_intelligence_evidence_refresh.py -q`

Expected: all tests pass; a failed refresh still reports failure while leaving the cache readable.

- [ ] **Step 5: Document the preservation rule**

In `src/swing_screener/intelligence/README.md`, state that forced refresh atomically replaces successful providers, preserves prior evidence for failed providers, and never destroys the last validated cache when all providers fail.

- [ ] **Step 6: Commit Task 1**

```bash
git add tests/test_evidence_collect.py src/swing_screener/intelligence/evidence/collect.py src/swing_screener/intelligence/README.md
git commit -m "fix(intelligence): preserve evidence cache"
```

---

### Task 2: Surface volume provider failures

**Files:**
- Modify: `tests/api/test_volume_analysis_endpoint.py`
- Modify: `api/routers/market_data.py`
- Modify: `api/README.md`

**Interfaces:**
- Produces: `GET /api/market-data/{ticker}/volume-analysis` returns sanitized HTTP 502 detail `{code, message, provider}` on provider exceptions.

- [ ] **Step 1: Change the existing soft-failure test to the required contract**

```python
def test_volume_analysis_reports_provider_failure(monkeypatch):
    prov = MagicMock(spec=MarketDataProvider)
    prov.fetch_ohlcv.side_effect = RuntimeError("api_key=secret")
    prov.get_provider_name.return_value = "mock"
    monkeypatch.setattr("api.routers.market_data.get_default_provider", lambda: prov)

    res = TestClient(app).get("/api/market-data/AAPL/volume-analysis")

    assert res.status_code == 502
    assert res.json()["detail"] == {
        "code": "market_data_provider_failed",
        "message": "Market data provider failed.",
        "provider": "mock",
    }
    assert "secret" not in res.text
```

Add a separate empty-frame test asserting HTTP 200 and `data_quality.ok is False`.

- [ ] **Step 2: Run the endpoint test and verify RED**

Run: `uv run pytest tests/api/test_volume_analysis_endpoint.py -q`

Expected: provider exception test receives HTTP 200.

- [ ] **Step 3: Raise the structured failure**

Replace the exception fallback with `HTTPException(status_code=502, detail={...})`, matching the candles endpoint's sanitized pattern. Leave the empty-frame branch intact.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `uv run pytest tests/api/test_volume_analysis_endpoint.py tests/api/test_market_data_candles_endpoint.py -q`

- [ ] **Step 5: Update API documentation and commit**

Document provider failure versus empty data in `api/README.md`, then:

```bash
git add tests/api/test_volume_analysis_endpoint.py api/routers/market_data.py api/README.md
git commit -m "fix(api): expose volume provider failure"
```

---

### Task 3: Correct frontend trust and identity contracts

**Files:**
- Modify: `web-ui/src/features/portfolio/api.test.ts`
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: `web-ui/src/features/intelligence/hooks.ts`
- Modify: `web-ui/src/features/intelligence/__tests__/traceHooks.test.tsx`
- Modify: `web-ui/src/features/workspaceData/useSymbolWorkspaceData.test.tsx`
- Modify: `web-ui/src/features/workspaceData/useSymbolWorkspaceData.ts`

**Interfaces:**
- Produces: `IntelligenceIdentityError`, strict latest-query symbol validation, authoritative price provenance, content-based intelligence staleness, and correct `all` order requests.

- [ ] **Step 1: Add failing order URL assertion**

In `portfolio/api.test.ts`, retain the fetch mock and assert:

```typescript
await fetchOrders('all');
expect(String(fetchMock.mock.calls[0][0])).not.toContain('status=all');
```

Also assert `fetchOrders('pending')` contains `status=pending`.

- [ ] **Step 2: Add failing intelligence identity test**

Render `useIntelligenceLatestQuery('AAPL', true)` with `getIntelligenceLatest` returning an MSFT payload and assert `result.current.error` is an `IntelligenceIdentityError`.

- [ ] **Step 3: Add failing workspace provenance/health tests**

Extend the hoisted candle result with:

```typescript
tickerCandlesResult.current = {
  data: {
    ticker: 'AAPL', provider: 'polygon', dataAsOf: '2026-07-28',
    fetchedAt: '2026-07-29T09:00:00Z', priceHistory: [{ date: '2026-07-28', close: 100 }], patterns: [],
  },
  dataUpdatedAt: Date.parse('2026-08-01T09:00:00Z'),
};
```

Assert the prices source exposes the three server fields, a current non-degraded intelligence result is `fresh`, and refetch completion after `generatedAt` does not make it outdated when `dataAsOf` predates generation.

- [ ] **Step 4: Run the three frontend test files and verify RED**

Run: `cd web-ui && npx vitest run src/features/portfolio/api.test.ts src/features/intelligence/__tests__/traceHooks.test.tsx src/features/workspaceData/useSymbolWorkspaceData.test.tsx`

Expected: literal `status=all`, missing identity rejection, missing price provider, permanent intelligence partial, and false outdated status.

- [ ] **Step 5: Implement minimal contract corrections**

- Set order params to `status !== 'all' ? ... : ''`.
- Export `IntelligenceIdentityError` and validate `data.symbol` against the normalized requested ticker inside the latest query function after transformation.
- In `useSymbolWorkspaceData`, use `pricesData.provider`, `pricesData.dataAsOf`, and `pricesData.fetchedAt`.
- Derive intelligence phase from `dataStatus` and `degradedReasons`; do not inspect a `provider` property.
- Use `pricesData.dataAsOf` in `isIntelligenceOutdated` dependencies.

- [ ] **Step 6: Run the focused frontend tests and verify GREEN**

Run: `cd web-ui && npx vitest run src/features/portfolio/api.test.ts src/features/intelligence src/features/workspaceData`

- [ ] **Step 7: Commit Task 3**

```bash
git add web-ui/src/features/portfolio/api.ts web-ui/src/features/portfolio/api.test.ts web-ui/src/features/intelligence/hooks.ts web-ui/src/features/intelligence/__tests__/traceHooks.test.tsx web-ui/src/features/workspaceData/useSymbolWorkspaceData.ts web-ui/src/features/workspaceData/useSymbolWorkspaceData.test.tsx
git commit -m "fix(web): trust server workspace metadata"
```

---

### Task 4: Add request-ID activity history

**Files:**
- Create: `web-ui/src/features/workspaceData/activity.ts`
- Create: `web-ui/src/features/workspaceData/activity.test.ts`
- Modify: `web-ui/src/features/workspaceData/types.ts`
- Modify: `web-ui/src/stores/workspaceStore.ts`
- Modify: `web-ui/src/stores/workspaceStore.test.ts`
- Modify: `web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.tsx`
- Modify: `web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx`
- Modify: `web-ui/src/components/domain/workspace/AnalysisCanvasPanel.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Produces:

```typescript
export type WorkspaceActivityPhase = 'active' | 'completed' | 'partial' | 'failed' | 'discarded';
export interface WorkspaceActivity {
  requestId: string;
  ticker: string;
  selectionVersion: number;
  sourceId: WorkspaceSourceId;
  phase: WorkspaceActivityPhase;
  startedAt: string;
  finishedAt: string | null;
  provider: string | null;
  message: string | null;
  retryable: boolean;
  pipelineStep: string | null;
  announced: boolean;
}
```

Store actions: `beginActivity(activity)`, `settleActivity(requestId, settlement)`, `dismissActivity(requestId)`, `markActivityAnnounced(requestId)`, and `clearActivities()`.

- [ ] **Step 1: Write failing pure lifecycle tests**

Assert `beginActivity` inserts an active record, settlement updates only the matching request ID, records are newest-first, and `limitActivities(records, 20)` caps history.

- [ ] **Step 2: Write failing store tests**

Assert the store records two concurrent same-source request IDs independently, preserves a discarded older-session record without changing current selection, dismisses one record, and marks one failure announced.

- [ ] **Step 3: Write failing drawer tests**

Render active/completed/partial/failed/discarded activities and assert every lifecycle label appears. Rerender the same unannounced failure after calling `markActivityAnnounced`; assert persistent content has `role="status"` and no second alert.

- [ ] **Step 4: Write failing integration tests**

In `AnalysisCanvasPanel.test.tsx`, trigger a prices refresh and assert an active record settles completed. In `SymbolAnalysisContent.test.tsx`, switch ticker/selection before an intelligence callback settles and assert the request becomes discarded without updating the displayed result.

- [ ] **Step 5: Run activity tests and verify RED**

Run: `cd web-ui && npx vitest run src/features/workspaceData/activity.test.ts src/stores/workspaceStore.test.ts src/components/domain/workspace/WorkspaceActivityDrawer.test.tsx src/components/domain/workspace/AnalysisCanvasPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx`

- [ ] **Step 6: Implement pure helpers and store actions**

Use immutable request-ID transitions and cap the store to 20 records. Normalize ticker on insertion. Clearing the visible workspace does not allow stale callbacks to update current data.

- [ ] **Step 7: Wire query and mutation lifecycle events**

Allocate IDs with `crypto.randomUUID()`. Capture ticker/version at request start. Settle matching callbacks; if the current store session differs, settle `discarded` and skip content/cache mutation. Pass activity records—not source snapshots—to `WorkspaceActivityDrawer`.

- [ ] **Step 8: Implement one-time alert semantics**

Render a short `role="alert"` node only for the newest unannounced failure, call `markActivityAnnounced` in an effect, and render the persistent drawer with `role="status"`.

- [ ] **Step 9: Run focused tests and verify GREEN**

Run: `cd web-ui && npx vitest run src/features/workspaceData src/stores/workspaceStore.test.ts src/components/domain/workspace/WorkspaceActivityDrawer.test.tsx src/components/domain/workspace/AnalysisCanvasPanel.test.tsx src/components/domain/workspace/SymbolAnalysisContent.test.tsx`

- [ ] **Step 10: Commit Task 4**

```bash
git add web-ui/src/features/workspaceData web-ui/src/stores/workspaceStore.ts web-ui/src/stores/workspaceStore.test.ts web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.tsx web-ui/src/components/domain/workspace/WorkspaceActivityDrawer.test.tsx web-ui/src/components/domain/workspace/AnalysisCanvasPanel.tsx web-ui/src/components/domain/workspace/AnalysisCanvasPanel.test.tsx web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx web-ui/src/components/domain/workspace/SymbolAnalysisContent.test.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(workspace): track request activity"
```

---

### Task 5: Render a real compact symbol rail

**Files:**
- Create: `web-ui/src/components/domain/workspace/SymbolRailRow.tsx`
- Create: `web-ui/src/components/domain/workspace/SymbolRailRow.test.tsx`
- Modify: `web-ui/src/components/domain/today/TodayActionList.tsx`
- Modify: `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx`
- Modify: `web-ui/src/components/domain/watchlist/WatchlistPipelinePanel.tsx`
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/pages/Today.test.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Produces `SymbolRailRow({ ticker, status, context, selected, onSelect })` and `compact?: boolean` props on the three existing source panels.

- [ ] **Step 1: Write failing shared-row tests**

Assert the row exposes a button with ticker/status/context, `aria-current="true"` when selected, and calls `onSelect(ticker)` from click and Enter.

- [ ] **Step 2: Expand Today integration tests for every source tab**

For Today, Screener, and Watchlist, select a symbol, assert the expanded left panel contains `data-testid="symbol-rail-list"`, contains compact row buttons, and does not contain the wide table header/form controls. Collapse and assert the wide content and its selected tab/filter state return.

- [ ] **Step 3: Run rail tests and verify RED**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/SymbolRailRow.test.tsx src/pages/Today.test.tsx`

Expected: missing component/compact props and full panel still rendered in the narrow column.

- [ ] **Step 4: Implement the shared row and compact variants**

Each existing panel uses its already-loaded collection. In compact mode it returns the shared rail list instead of wide controls/table/cards. `Today.tsx` computes `compact = Boolean(selectedTicker && workspaceMode === 'expanded')` and passes it to the active panel. The panel component remains mounted across mode changes.

- [ ] **Step 5: Run rail and neighboring component tests**

Run: `cd web-ui && npx vitest run src/components/domain/workspace/SymbolRailRow.test.tsx src/pages/Today.test.tsx src/components/domain/workspace/ScreenerInboxPanel.test.tsx src/components/domain/watchlist/WatchlistPipelinePanel.test.tsx`

- [ ] **Step 6: Commit Task 5**

```bash
git add web-ui/src/components/domain/workspace/SymbolRailRow.tsx web-ui/src/components/domain/workspace/SymbolRailRow.test.tsx web-ui/src/components/domain/today/TodayActionList.tsx web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx web-ui/src/components/domain/watchlist/WatchlistPipelinePanel.tsx web-ui/src/pages/Today.tsx web-ui/src/pages/Today.test.tsx web-ui/src/i18n/messages.en.ts
git commit -m "feat(workspace): render compact symbol rail"
```

---

### Task 6: Align documentation and whitespace

**Files:**
- Modify: `web-ui/docs/WEB_UI_GUIDE.md`
- Modify: `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- Modify: `docs/superpowers/specs/2026-07-28-workspace-status-truth-design.md`

- [ ] **Step 1: Update exact architecture statements**

Document that source health is a current snapshot, activity history is request-ID based and capped at 20 records, late ticker/version callbacks are recorded as discarded, and expanded Today panels render compact variants without changing their data owner.

- [ ] **Step 2: Remove trailing spaces and verify**

Run: `git diff --check b392454ee39265bb419c3dd500f129f850087898..HEAD`

Expected: no output and exit 0.

- [ ] **Step 3: Commit Task 6**

```bash
git add web-ui/docs/WEB_UI_GUIDE.md web-ui/docs/WEB_UI_ARCHITECTURE.md docs/superpowers/specs/2026-07-28-workspace-status-truth-design.md
git commit -m "docs: align workspace trust behavior"
```

---

### Task 7: Full verification and delivery audit

**Files:**
- Modify if needed: only files already listed in Tasks 1-6.

- [ ] **Step 1: Run backend focused verification**

Run: `uv run pytest tests/test_evidence_collect.py tests/test_intelligence_evidence_refresh.py tests/api/test_volume_analysis_endpoint.py tests/api/test_market_data_candles_endpoint.py -q`

- [ ] **Step 2: Run backend full suite**

Run: `uv run pytest -q`

- [ ] **Step 3: Run frontend focused verification**

Run: `cd web-ui && npx vitest run src/features/workspaceData src/features/intelligence src/features/portfolio/api.test.ts src/stores/workspaceStore.test.ts src/components/domain/workspace src/pages/Today.test.tsx`

- [ ] **Step 4: Run frontend full suite and static checks**

Run:

```bash
cd web-ui
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 5: Run Python lint and diff checks**

Run:

```bash
uv run ruff check src/swing_screener/intelligence/evidence/collect.py api/routers/market_data.py tests/test_evidence_collect.py tests/api/test_volume_analysis_endpoint.py
git diff --check b392454ee39265bb419c3dd500f129f850087898..HEAD
git status --short
```

- [ ] **Step 6: Review the complete stacked diff**

Run `git diff --stat b392454..HEAD` and `git diff b392454..HEAD`; confirm all eleven review findings map to code/tests/docs and no Backtest production file changed.

- [ ] **Step 7: Prepare delivery metadata**

Write `prs.md` with compare URL base `feat/symbol-workspace-redesign`, imperative title, root-cause explanation, impact, and exact verification results. Do not include the existing PR #435 changes in the stacked PR summary.
