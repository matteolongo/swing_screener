# Workspace Status Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make absent today-only intelligence, prior-day evidence, and stale financial reporting periods truthful and actionable in the symbol workspace.

**Architecture:** Add a read-only API summary for the newest persisted evidence cache. Compose that summary with the existing workspace sources; map only the exact today-cache-miss response to neutral idle state, and show snapshot fetch time separately from reporting-period age.

**Tech Stack:** FastAPI/Pydantic, JSON evidence cache, React, TypeScript, React Query, pytest, Vitest/MSW.

## Global Constraints

- Keep Backtest unchanged.
- Never collect evidence or generate intelligence on symbol selection.
- Preserve `POST /api/intelligence/{ticker}/evidence/refresh` as the only collection action.
- Only the known `No cached analysis for {ticker} today` 404 becomes idle; all other errors remain failed.
- Use i18n for visible copy and preserve snake_case-to-camelCase at the API boundary.

---

### Task 1: Read-only latest-evidence summary

**Files:**
- Modify: `src/swing_screener/intelligence/evidence/collect.py`
- Modify: `api/routers/intelligence.py`
- Modify: `tests/test_evidence_collect.py`
- Modify: `tests/test_intelligence_evidence_refresh.py`
- Modify: `api/README.md`, `src/swing_screener/intelligence/README.md`

**Interface:** `read_latest_cached_evidence_summary(ticker: str, *, cache_root: Path | None = None) -> EvidenceCacheSummary | None`; `GET /api/intelligence/{ticker}/evidence/latest` responds with `ticker`, `cached_at`, `item_count`, and `providers`.

- [ ] Write failing tests for newest valid ticker cache and a 404 when no cache exists.

```python
def test_read_latest_cached_evidence_summary_uses_newest_valid_ticker_cache(tmp_path):
    _write_evidence(tmp_path / '2026-07-27' / 'AAPL.json', provider='old', count=1)
    _write_evidence(tmp_path / '2026-07-28' / 'AAPL.json', provider='new', count=2)
    assert read_latest_cached_evidence_summary('aapl', cache_root=tmp_path).item_count == 2

def test_latest_evidence_endpoint_returns_404_without_cache(client, monkeypatch):
    monkeypatch.setattr('api.routers.intelligence.read_latest_cached_evidence_summary', lambda _: None)
    assert client.get('/api/intelligence/AAPL/evidence/latest').status_code == 404
```

- [ ] Run `uv run pytest tests/test_evidence_collect.py tests/test_intelligence_evidence_refresh.py -q`; expect failure because the helper and route do not exist.
- [ ] Implement the helper by scanning date-named evidence directories newest-first, using `_read_cache`, and returning normalized ticker/date/count/distinct providers. Add the additive Pydantic response and route before generic `/{ticker}` routes. The route must not call `collect_evidence`.
- [ ] Re-run the same tests; expect pass.
- [ ] Update API/intelligence docs and commit `feat: expose cached evidence summary`.

### Task 2: Neutral today-cache miss and cached-evidence workspace state

**Files:**
- Modify: `web-ui/src/lib/fetchJson.ts`, `web-ui/src/lib/api.ts`, `web-ui/src/lib/queryKeys.ts`
- Modify: `web-ui/src/features/intelligence/types.ts`, `api.ts`, `hooks.ts`
- Modify: `web-ui/src/features/workspaceData/types.ts`, `useSymbolWorkspaceData.ts`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`, `SymbolIntelligenceTab.tsx`
- Modify: `web-ui/src/features/intelligence/api.test.ts`, `web-ui/src/features/workspaceData/useSymbolWorkspaceData.test.tsx`, `web-ui/src/components/domain/workspace/SymbolIntelligenceTab.test.tsx`, `web-ui/src/i18n/messages.en.ts`

**Interfaces:** `ApiHttpError(message: string, status: number)`; `EvidenceCacheSummary { ticker, cachedAt, itemCount, providers }`; `useLatestEvidenceSummaryQuery(ticker, enabled)`; `queryKeys.intelligence.evidenceLatest(ticker)`.

- [ ] Write failing tests.

```tsx
it('maps only the known today-cache miss to neutral not-generated-today state', async () => {
  server.use(http.get(`${API_BASE_URL}/api/intelligence/AAPL/latest`, () =>
    HttpResponse.json({ detail: 'No cached analysis for AAPL today' }, { status: 404 }),
  ));
  renderWorkspace('AAPL');
  expect(await screen.findByText(t('workspacePage.intelligence.notGeneratedToday'))).toBeVisible();
  expect(screen.getByRole('button', { name: t('workspacePage.intelligence.generate') })).toBeVisible();
  expect(screen.queryByRole('button', { name: t('workspacePage.data.retry') })).not.toBeInTheDocument();
});

it('shows prior-day evidence as cached without posting generation or collection', async () => {
  server.use(http.get(`${API_BASE_URL}/api/intelligence/AAPL/evidence/latest`, () =>
    HttpResponse.json({ ticker: 'AAPL', cached_at: '2026-07-27', item_count: 8, providers: ['REFINITIV_LATEST_NEWS'] }),
  ));
  renderWorkspace('AAPL');
  expect(await screen.findByText(/Jul 27.*8/)).toBeVisible();
});
```

- [ ] Run `cd web-ui && npx vitest run src/features/intelligence/api.test.ts src/features/workspaceData/useSymbolWorkspaceData.test.tsx src/components/domain/workspace/SymbolIntelligenceTab.test.tsx`; expect failure.
- [ ] Implement `ApiHttpError` in `fetchJson`, endpoint/type/query transformation, and a cache-summary query. In `useSymbolWorkspaceData`, map only the matching `ApiHttpError` to intelligence `idle` with `analysisNotGeneratedToday`; leave every other error failed. Compose cached evidence with provider/date/count and mark it cached/stale, not fresh. Pass it to the manifest and render localized cached-evidence and not-generated-today copy.
- [ ] Re-run the focused tests; expect pass, including non-matching 404/500 failed-state regressions.
- [ ] Commit `fix: clarify workspace intelligence state`.

### Task 3: Explain reporting-period freshness in Fundamentals

**Files:**
- Modify: `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.test.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`, `web-ui/docs/WEB_UI_GUIDE.md`, `CHANGELOG.md`

- [ ] Write a failing stale-snapshot test.

```tsx
it('distinguishes a current snapshot fetch from a stale reported quarter', () => {
  renderWithProviders(<SymbolFundamentalsTab model={{ ...model, snapshot: {
    ...snapshot, updatedAt: '2026-07-28T13:26:01Z', freshnessStatus: 'stale', mostRecentQuarter: '2026-03-28',
  } }} />);
  expect(screen.getByText(t('workspacePage.fundamentals.reportingPeriodStale', { date: '2026-03-28' }))).toBeVisible();
});
```

- [ ] Run `cd web-ui && npx vitest run src/components/domain/workspace/SymbolFundamentalsTab.test.tsx`; expect failure.
- [ ] Render localized snapshot refresh time and, only for a stale snapshot with `mostRecentQuarter`, localized reporting-period age copy. Do not change server freshness policy.
- [ ] Re-run the same test; expect pass.
- [ ] Update the Web UI guide and Unreleased changelog; commit `fix: explain stale reporting periods`.

### Task 4: Verify and publish the existing PR

**Files:**
- Modify: session scratchpad `prs.md` with updated verification and screenshot status.

- [ ] Run `uv run pytest tests/test_evidence_collect.py tests/test_intelligence_evidence_refresh.py -q` and the focused Vitest files from Tasks 2-3.
- [ ] Run `uv run pytest -q`, then `cd web-ui && npx vitest run --reporter=dot && npm run typecheck && npm run lint && npm run build`.
- [ ] Run `uv run ruff check api/routers/intelligence.py src/swing_screener/intelligence/evidence/collect.py tests/test_evidence_collect.py tests/test_intelligence_evidence_refresh.py`, `git diff --check`, then push `feat/symbol-workspace-redesign` and update draft PR #435.

## Self-review

- Task 1 supplies cache metadata without side effects.
- Task 2 maps known absence to idle and preserves real failures.
- Task 3 explains the two independent fundamentals dates.
- Task 4 covers full verification, documentation, and PR delivery.
