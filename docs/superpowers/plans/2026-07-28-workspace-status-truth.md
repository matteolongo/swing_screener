# Workspace Status Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make absent today-only intelligence, prior-day evidence, and stale financial reporting periods truthful and actionable in the symbol workspace.

**Architecture:** Add a read-only API summary for the newest persisted evidence cache, including server-derived freshness. Compose that summary with the existing workspace sources; map stable, typed known-absence errors to neutral idle states, preserve all other failures, and show snapshot fetch time separately from reporting-period age.

**Tech Stack:** FastAPI/Pydantic, JSON evidence cache, React, TypeScript, React Query, pytest, Vitest/MSW.

## Global Constraints

- Keep Backtest unchanged.
- Never collect evidence or generate intelligence on symbol selection.
- Preserve `POST /api/intelligence/{ticker}/evidence/refresh` as the only collection action.
- Only `analysis_not_generated_today` and `evidence_not_cached` become their defined idle states; all other errors remain failed.
- The server, not the browser, determines evidence freshness. The UI displays the returned `freshness_status` and source date.
- Use i18n for visible copy and preserve snake_case-to-camelCase at the API boundary.

---

### Task 1: Read-only latest-evidence summary

**Files:**
- Modify: `src/swing_screener/intelligence/evidence/collect.py`
- Modify: `src/swing_screener/intelligence/evidence/config.py`
- Modify: `api/routers/intelligence.py`
- Modify: `tests/test_evidence_collect.py`
- Modify: `tests/test_intelligence_evidence_refresh.py`
- Modify: `tests/api/test_intelligence_api.py`
- Modify: `config/intelligence.yaml`, `config/README.md`, `api/README.md`, `src/swing_screener/intelligence/README.md`

**Interface:** `EvidenceConfig.cache_stale_after_days: int`; `read_latest_cached_evidence_summary(ticker: str, *, cache_root: Path | None = None, current_date: date | None = None) -> EvidenceCacheSummary | None`; `GET /api/intelligence/{ticker}/evidence/latest` responds with `ticker`, `cached_at`, `item_count`, `providers`, and server-derived `freshness_status` (`fresh`, `cached`, or `stale`). A normal absent cache returns `404` with legacy string `detail` and top-level `code = "evidence_not_cached"`. `GET /api/intelligence/{ticker}/latest` preserves its legacy string `detail` and adds top-level `code = "analysis_not_generated_today"` for its known cache miss.

- [ ] Write failing tests for newest valid ticker cache and a 404 when no cache exists.

```python
def test_read_latest_cached_evidence_summary_uses_newest_valid_ticker_cache(tmp_path):
    _write_evidence(tmp_path / '2026-07-27' / 'AAPL.json', provider='old', count=1)
    _write_evidence(tmp_path / '2026-07-28' / 'AAPL.json', provider='new', count=2)
    assert read_latest_cached_evidence_summary('aapl', cache_root=tmp_path).item_count == 2

def test_latest_evidence_endpoint_returns_404_without_cache(client, monkeypatch):
    monkeypatch.setattr('api.routers.intelligence.read_latest_cached_evidence_summary', lambda _: None)
    response = client.get('/api/intelligence/AAPL/evidence/latest')
    assert response.status_code == 404
    assert response.json()['code'] == 'evidence_not_cached'

def test_latest_analysis_miss_keeps_detail_and_adds_stable_code(client, monkeypatch):
    monkeypatch.setattr('api.routers.intelligence.read_from_cache', lambda _: None)
    response = client.get('/api/intelligence/AAPL/latest')
    assert response.status_code == 404
    assert isinstance(response.json()['detail'], str)
    assert response.json()['code'] == 'analysis_not_generated_today'

def test_read_latest_cached_evidence_summary_returns_server_owned_staleness(tmp_path):
    _write_evidence(tmp_path / '2026-07-27' / 'AAPL.json', provider='news', count=1)
    summary = read_latest_cached_evidence_summary(
        'AAPL', cache_root=tmp_path, current_date=date(2026, 7, 29),
    )
    assert summary.freshness_status == 'stale'
```

- [ ] Run `uv run pytest tests/test_evidence_collect.py tests/test_intelligence_evidence_refresh.py tests/api/test_intelligence_api.py -q`; expect failure because the helper, freshness metadata, and stable error codes do not exist.
- [ ] Add `intelligence.evidence.cache_stale_after_days` (non-negative integer) to `config/intelligence.yaml`, load and validate it in `EvidenceConfig`, and document the key in `config/README.md`. Implement the helper by scanning date-named evidence directories newest-first, using `_read_cache`, and returning normalized ticker/date/count/distinct providers plus server-owned `freshness_status`: `fresh` when `cached_at` is the server's current UTC date, `cached` when its age is within the configured number of days, otherwise `stale`. Calculate that status from the injected server date and this YAML value; do not calculate it from browser time. Add the additive Pydantic response and route before generic `/{ticker}` routes. The route must not call `collect_evidence`.
- [ ] Return `{ "detail": "...", "code": "analysis_not_generated_today" }` for the known latest-analysis miss and `{ "detail": "...", "code": "evidence_not_cached" }` for the known evidence-cache miss. Retaining string `detail` preserves existing API consumers; unknown 404s and all other errors must not receive either code.
- [ ] Re-run the same tests; expect pass.
- [ ] Update API/intelligence docs and commit `feat: expose cached evidence summary`.

### Task 2: Neutral today-cache miss and cached-evidence workspace state

**Files:**
- Modify: `web-ui/src/lib/fetchJson.ts`, `web-ui/src/lib/api.ts`, `web-ui/src/lib/queryKeys.ts`
- Modify: `web-ui/src/features/intelligence/types.ts`, `api.ts`, `hooks.ts`
- Modify: `web-ui/src/features/workspaceData/types.ts`, `useSymbolWorkspaceData.ts`
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`, `SymbolIntelligenceTab.tsx`
- Modify: `web-ui/src/features/intelligence/api.test.ts`, `web-ui/src/features/workspaceData/useSymbolWorkspaceData.test.tsx`, `web-ui/src/components/domain/workspace/SymbolIntelligenceTab.test.tsx`, `web-ui/src/lib/fetchJson.test.ts`, `web-ui/src/i18n/messages.en.ts`

**Interfaces:** `ApiHttpError(message: string, status: number, code: string | null)`; `EvidenceCacheSummary { ticker, cachedAt, itemCount, providers, freshnessStatus: 'fresh' | 'cached' | 'stale' }`; `useLatestEvidenceSummaryQuery(ticker, enabled)`; `queryKeys.intelligence.evidenceLatest(ticker)`.

- [ ] Write failing tests.

```tsx
it('maps only the known today-cache miss to neutral not-generated-today state', async () => {
  server.use(http.get(`${API_BASE_URL}/api/intelligence/AAPL/latest`, () =>
    HttpResponse.json({ detail: 'No analysis has been generated today.', code: 'analysis_not_generated_today' }, { status: 404 }),
  ));
  renderWorkspace('AAPL');
  expect(await screen.findByText(t('workspacePage.intelligence.notGeneratedToday'))).toBeVisible();
  expect(screen.getByRole('button', { name: t('workspacePage.intelligence.generate') })).toBeVisible();
  expect(screen.queryByRole('button', { name: t('workspacePage.data.retry') })).not.toBeInTheDocument();
});

it('maps an absent evidence cache to neutral not-cached state', async () => {
  server.use(http.get(`${API_BASE_URL}/api/intelligence/AAPL/evidence/latest`, () =>
    HttpResponse.json({ detail: 'No saved evidence is available yet.', code: 'evidence_not_cached' }, { status: 404 }),
  ));
  renderWorkspace('AAPL');
  expect(await screen.findByText(t('workspacePage.intelligence.evidenceNotCached'))).toBeVisible();
  expect(screen.getByRole('button', { name: t('workspacePage.intelligence.refreshEvidence') })).toBeVisible();
  expect(screen.queryByRole('button', { name: t('workspacePage.data.retry') })).not.toBeInTheDocument();
});

it('shows prior-day evidence as cached without posting generation or collection', async () => {
  server.use(http.get(`${API_BASE_URL}/api/intelligence/AAPL/evidence/latest`, () =>
    HttpResponse.json({ ticker: 'AAPL', cached_at: '2026-07-27', item_count: 8, providers: ['REFINITIV_LATEST_NEWS'], freshness_status: 'cached' }),
  ));
  renderWorkspace('AAPL');
  expect(await screen.findByText(/Jul 27.*8/)).toBeVisible();
});

it.each([
  [404, 'different_code'],
  [500, null],
] as const)('keeps a nonmatching HTTP failure retryable (%s)', async (status, code) => {
  server.use(http.get(`${API_BASE_URL}/api/intelligence/AAPL/latest`, () =>
    HttpResponse.json({ detail: 'Unexpected failure.', code }, { status }),
  ));
  renderWorkspace('AAPL');
  expect(await screen.findByRole('button', { name: t('workspacePage.data.retry') })).toBeVisible();
});

it.each([
  [{ detail: 'Known absence.', code: 'analysis_not_generated_today' }, 404, 'analysis_not_generated_today'],
  [{ detail: { message: 'Legacy structured error.', code: 'legacy_code' } }, 422, 'legacy_code'],
  [{ detail: 'String-only error.' }, 503, null],
])('preserves status and optional code from API errors', async (body, status, expectedCode) => {
  server.use(http.get('/error', () => HttpResponse.json(body, { status })));
  await expect(fetchJson('/error')).rejects.toMatchObject({ status, code: expectedCode });
});

it('preserves status and fallback message for a non-JSON failure', async () => {
  server.use(http.get('/error', () => new HttpResponse('upstream unavailable', { status: 502 })));
  await expect(fetchJson('/error')).rejects.toMatchObject({ status: 502, code: null });
});
```

- [ ] Run `cd web-ui && npx vitest run src/features/intelligence/api.test.ts src/features/workspaceData/useSymbolWorkspaceData.test.tsx src/components/domain/workspace/SymbolIntelligenceTab.test.tsx src/lib/fetchJson.test.ts`; expect failure.
- [ ] Add direct `fetchJson` tests for top-level `code` plus string `detail`, legacy structured `detail` (`code` and `message`), string-only `detail`, and non-JSON error bodies. Implement `ApiHttpError` in `fetchJson`, retaining `message`, HTTP `status`, and nullable stable `code`; preserve current fallback behavior for non-JSON responses. Add endpoint/type/query transformation and a cache-summary query.
- [ ] In `useSymbolWorkspaceData`, map only `ApiHttpError.code === 'analysis_not_generated_today'` to intelligence `idle` with `analysisNotGeneratedToday`, and only `code === 'evidence_not_cached'` to evidence `idle` with `evidenceNotCached`; leave every other error failed. Compose evidence provider/date/count with the returned `freshnessStatus`; never derive it from `Date.now()`. Pass the states to the manifest and render the localized copy matrix for cached evidence, both neutral absences, failed sources, and refreshing-with-prior-content.
- [ ] Re-run the focused tests; expect pass, including parser regressions and nonmatching 404/500 failed-state regressions.
- [ ] Commit `fix: clarify workspace intelligence state`.

### Task 3: Explain reporting-period freshness in Fundamentals

**Files:**
- Modify: `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.tsx`
- Modify: `web-ui/src/components/domain/workspace/SymbolFundamentalsTab.test.tsx`
- Modify: `web-ui/src/components/domain/workspace/DataStatusBar.tsx`
- Modify: `web-ui/src/components/domain/workspace/DataStatusBar.test.tsx`
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

- [ ] Run `cd web-ui && npx vitest run src/components/domain/workspace/SymbolFundamentalsTab.test.tsx src/components/domain/workspace/DataStatusBar.test.tsx`; expect failure.
- [ ] Render localized snapshot refresh time and, only for a stale snapshot with `mostRecentQuarter`, localized reporting-period age copy. Do not change server freshness policy.
- [ ] Reuse the same localized copy keys in the source-status detail and Fundamentals tab so the header does not describe the reporting period as a failed fetch.
- [ ] Re-run the same tests; expect pass.
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
