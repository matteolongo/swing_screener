# Frontend Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Repair the audited frontend correctness, failure-feedback, accessibility, and consistency defects without expanding the trading product surface.

**Architecture:** Keep serializers at the API boundary, React Query keys in src/lib/queryKeys.ts, and mutation errors alongside their initiating control. Reuse ModalShell, Field, native buttons, and existing workspace tab semantics rather than adding dependencies or shared frameworks. Each task begins with a failing regression test and contains the smallest change that makes it pass.

**Tech Stack:** React 18, TypeScript, TanStack React Query, Zustand, Vitest, Testing Library, MSW, Vite, Tailwind.

**Spec:** docs/superpowers/specs/2026-10-01-frontend-remediation-design.md

## Global Constraints

- Preserve manual broker execution and the intraday read-only boundary.
- Preserve R-based risk: held 1R is initial per-share risk, not current stop distance.
- Do not change endpoints, persisted schema versions, backend code, or dependency versions.
- Add every new visible string through existing i18n messages and use t in tests.
- Keep all production cache-key arrays owned by queryKeys.ts.
- Reuse ModalShell, Field, Textarea, Button, and existing complete tab semantics.
- Write and observe each regression test failing before its production change.
- Update the Web UI guide, architecture, and documentation index for changed contracts.

---

### Task 1: Preserve local stop policy and truthful logout state

**Files:**
- Modify: web-ui/src/features/dailyReview/api.ts
- Modify: web-ui/src/features/portfolio/api.ts
- Modify: web-ui/src/features/auth/AuthProvider.tsx
- Test: web-ui/src/features/dailyReview/api.test.ts
- Test: web-ui/src/features/portfolio/api.test.ts
- Test: web-ui/src/features/auth/AuthProvider.test.tsx

**Interfaces:**
- Consumes: Position.trailMethod/trailParam and apiFetch() Response results.
- Produces: review payloads with trail_method/trail_param and a logout promise that rejects without clearing authenticated state on a non-OK response.

- [ ] **Step 1: Write the failing regression tests**

~~~tsx
it('sends a manual trailing policy to local daily review', async () => {
  writeTradingStore({ ...createDefaultTradingStore(), positions: [{ ...position, trailMethod: 'manual', trailParam: null }] });
  server.use(http.post(API_BASE_URL + '/api/daily-review/compute', async ({ request }) => {
    expect((await request.json()).positions[0]).toMatchObject({ trail_method: 'manual', trail_param: null });
    return HttpResponse.json(reviewResponse);
  }));
  await getDailyReview();
});

it('keeps an authenticated session when logout returns HTTP 500', async () => {
  server.use(http.post(API_BASE_URL + '/api/auth/logout', () => HttpResponse.json({ detail: 'logout failed' }, { status: 500 })));
  await expect(auth.logout()).rejects.toThrow();
  expect(auth.status).toBe('authenticated');
});
~~~

Add the same request-body assertion for local stop-suggestion computation.

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- --run src/features/dailyReview/api.test.ts src/features/portfolio/api.test.ts src/features/auth/AuthProvider.test.tsx --maxWorkers=1 --minWorkers=1

Expected: local request bodies omit trail_method and failed logout leaves the provider anonymous.

- [ ] **Step 3: Write minimal implementation**

~~~ts
trail_method: position.trailMethod ?? 'sma20',
trail_param: position.trailParam ?? null,

const response = await apiFetch(API_ENDPOINTS.authLogout, { method: 'POST' });
if (!response.ok) throw new Error('Failed to sign out');
becomeAnonymous();
~~~

Add those two fields in both incomplete local serializers only. Do not mutate local records or alter server-mode behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- --run src/features/dailyReview/api.test.ts src/features/portfolio/api.test.ts src/features/auth/AuthProvider.test.tsx --maxWorkers=1 --minWorkers=1

Expected: PASS; logout stays authenticated after 500 and becomes anonymous after 200.

- [ ] **Step 5: Commit**

~~~bash
git add web-ui/src/features/dailyReview/api.ts web-ui/src/features/portfolio/api.ts web-ui/src/features/auth/AuthProvider.tsx web-ui/src/features/dailyReview/api.test.ts web-ui/src/features/portfolio/api.test.ts web-ui/src/features/auth/AuthProvider.test.tsx
git commit -m "fix: preserve review policy and logout state"
~~~

### Task 2: Keep selected review facts and live previews accurate

**Files:**
- Modify: web-ui/src/components/domain/market/CachedSymbolCandleChart.tsx
- Modify: web-ui/src/components/domain/cockpit/SymbolDetailPanel.tsx
- Modify: web-ui/src/components/domain/workspace/SymbolOverviewTab.tsx
- Modify: web-ui/src/components/domain/workspace/ManagePositionPanel.tsx
- Modify: web-ui/src/components/domain/workspace/AnalysisDecisionStrip.tsx
- Modify: web-ui/src/features/portfolio/hooks.ts
- Test: web-ui/src/components/domain/market/CachedSymbolCandleChart.test.tsx
- Test: web-ui/src/components/domain/workspace/ManagePositionPanel.test.tsx
- Test: web-ui/src/components/domain/workspace/AnalysisDecisionStrip.test.tsx

**Interfaces:**
- Consumes: WorkspaceSelection.candidate, PositionWithMetrics.perShareRisk, canonical order drafts, and a preview query refetch method.
- Produces: chart overlays from the selected snapshot, a fresh read-only preview on every button invocation, and held entry/1R values immune to add-on drafts.

- [ ] **Step 1: Write the failing regression tests**

~~~tsx
it('uses the selected candidate instead of Last Run for chart overlays', () => {
  seedWorkspaceSelection(candidate(100));
  seedLastRun(candidate(200));
  renderWithProviders(<CachedSymbolCandleChart ticker="AUDIT" />);
  expect(chartProps().entryPrice).toBe(100);
});

it('requests a fresh preview on every Check live invocation', async () => {
  await user.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.checkLive') }));
  await user.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.checkLive') }));
  await waitFor(() => expect(previewRequests).toBe(2));
});

it('uses held entry and initial risk with an add-on draft', () => {
  renderWithProviders(<AnalysisDecisionStrip ticker="AUDIT" position={heldAt100WithRisk10} candidate={addOnAt120} />);
  expect(tradePlanRow('entry')).toHaveTextContent(formatCurrency(100, 'USD'));
  expect(tradePlanRow('oneR')).toHaveTextContent(formatCurrency(10, 'USD'));
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- --run src/components/domain/market/CachedSymbolCandleChart.test.tsx src/components/domain/workspace/ManagePositionPanel.test.tsx src/components/domain/workspace/AnalysisDecisionStrip.test.tsx --maxWorkers=1 --minWorkers=1

Expected: chart gets the Last Run entry, only one preview request occurs, and held-plan rows use draft entry/current stop distance.

- [ ] **Step 3: Write minimal implementation**

~~~ts
const selectedCandidate = selection?.ticker.toUpperCase() === symbol ? selection.candidate : null;
const chartCandidate = selectedCandidate ?? lastRunCandidate;

const handleCheckLive = () => {
  setHasCheckedLive(true);
  void stopPreview.refetch();
};

const entry = heldMode ? position.entryPrice : plannedEntry;
const oneR = heldMode ? (position.perShareRisk ?? position.initialRisk ?? null) : entryMinusStop;
~~~

Use the selection candidate when available, retain Last Run/direct-candle fallbacks for unselected symbols, and render a preview request error as a local alert.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- --run src/components/domain/market/CachedSymbolCandleChart.test.tsx src/components/domain/workspace/ManagePositionPanel.test.tsx src/components/domain/workspace/AnalysisDecisionStrip.test.tsx --maxWorkers=1 --minWorkers=1

Expected: PASS; a second live action makes a second request and held facts never combine with an add-on draft.

- [ ] **Step 5: Commit**

~~~bash
git add web-ui/src/components/domain/market/CachedSymbolCandleChart.tsx web-ui/src/components/domain/cockpit/SymbolDetailPanel.tsx web-ui/src/components/domain/workspace/SymbolOverviewTab.tsx web-ui/src/components/domain/workspace/ManagePositionPanel.tsx web-ui/src/components/domain/workspace/AnalysisDecisionStrip.tsx web-ui/src/features/portfolio/hooks.ts web-ui/src/components/domain/market/CachedSymbolCandleChart.test.tsx web-ui/src/components/domain/workspace/ManagePositionPanel.test.tsx web-ui/src/components/domain/workspace/AnalysisDecisionStrip.test.tsx
git commit -m "fix: keep review snapshots and held trade facts coherent"
~~~

### Task 3: Synchronize local state and centralize cache contracts

**Files:**
- Modify: web-ui/src/lib/queryKeys.ts
- Modify: web-ui/src/lib/queryInvalidation.ts
- Modify: web-ui/src/features/persistence/sync.ts
- Modify: web-ui/src/features/portfolio/hooks.ts
- Modify: web-ui/src/features/weeklyReview/hooks.ts
- Modify: web-ui/src/features/screener/recurrenceHooks.ts
- Modify: web-ui/src/test/mocks/handlers.ts
- Modify: web-ui/src/test/setup.ts
- Test: web-ui/src/lib/queryInvalidation.test.ts
- Test: web-ui/src/features/persistence/sync.test.ts

**Interfaces:**
- Consumes: storage old/new values and query prefix invalidation.
- Produces: named factories for production keys, Daily Review/watchlist invalidation for ledger events, selection reset for active strategy changes, and strict MSW API handling.

- [ ] **Step 1: Write failing cache and cross-tab regressions**

~~~ts
it('invalidates review and watchlist pipeline after another tab writes the ledger', () => {
  queryClient.setQueryData(queryKeys.dailyReview(0, 'portfolio'), review);
  queryClient.setQueryData(queryKeys.watchlistPipeline(), rows);
  dispatchTradingStoreStorageEvent();
  expect(queryClient.getQueryState(queryKeys.dailyReview(0, 'portfolio'))?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(queryKeys.watchlistPipeline())?.isInvalidated).toBe(true);
});

it('clears selection and actionable runs when another tab changes activeStrategyId', () => {
  seedSelectedActionableRun();
  dispatchTradingStoreStorageEvent({ activeStrategyId: 'old' }, { activeStrategyId: 'new' });
  expect(useWorkspaceStore.getState().selection).toBeNull();
  expect(useScreenerStore.getState().todayRun).toBeNull();
});
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- --run src/lib/queryInvalidation.test.ts src/features/persistence --maxWorkers=1 --minWorkers=1

Expected: Daily Review remains valid and the selected run survives the strategy event.

- [ ] **Step 3: Write minimal implementation**

~~~ts
dailyReviewPrefix: () => ['dailyReview'] as const,
earningsProximity: (ticker?: string) => ['earnings-proximity', ticker ?? null] as const,
regimeBreakdown: () => ['regime-breakdown'] as const,

await invalidateDailyReviewQueries(queryClient);
await queryClient.invalidateQueries({ queryKey: queryKeys.watchlistPipeline() });
~~~

Parse storage values defensively. Only clear selection/actionable runs when activeStrategyId differs. Replace touched inline production keys, add recurrence and regime-breakdown default handlers, then fail unhandled /api/ requests in MSW.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- --run src/lib/queryInvalidation.test.ts src/features/persistence src/pages/Book.test.tsx src/pages/Universes.test.tsx src/components/domain/workspace/ScreenerInboxPanel.test.tsx --maxWorkers=1 --minWorkers=1

Expected: PASS with no unmatched application-request warnings.

- [ ] **Step 5: Commit**

~~~bash
git add web-ui/src/lib/queryKeys.ts web-ui/src/lib/queryInvalidation.ts web-ui/src/features/persistence/sync.ts web-ui/src/features/portfolio/hooks.ts web-ui/src/features/weeklyReview/hooks.ts web-ui/src/features/screener/recurrenceHooks.ts web-ui/src/test/mocks/handlers.ts web-ui/src/test/setup.ts web-ui/src/lib/queryInvalidation.test.ts web-ui/src/features/persistence
git commit -m "fix: synchronize review state across local tabs"
~~~

### Task 4: Surface action failures where users can retry them

**Files:**
- Modify: web-ui/src/components/layout/Header.tsx
- Modify: web-ui/src/features/strategy/hooks.ts
- Modify: web-ui/src/components/domain/cockpit/SymbolDetailPanel.tsx
- Modify: web-ui/src/pages/DataSources.tsx
- Modify: web-ui/src/i18n/messages.en.ts
- Test: web-ui/src/components/layout/Header.test.tsx
- Test: web-ui/src/components/domain/cockpit/SymbolDetailPanel.test.tsx
- Test: web-ui/src/pages/DataSources.test.tsx

**Interfaces:**
- Consumes: mutation isError/error state and last confirmed query data.
- Produces: role="alert" feedback for failed strategy, logout, watchlist, and data-source operations; one textual header health state that includes read or strategy-action errors.

- [ ] **Step 1: Write failing feedback tests**

~~~tsx
it('keeps the confirmed strategy and reports a failed strategy change', async () => {
  server.use(http.put(API_BASE_URL + '/api/strategy/active', () => HttpResponse.json({ detail: 'strategy unavailable' }, { status: 500 })));
  await user.selectOptions(screen.getByLabelText(t('sidebar.activeStrategy')), 'alternative');
  expect(await screen.findByRole('alert')).toHaveTextContent('strategy unavailable');
  expect(screen.getByLabelText(t('sidebar.activeStrategy'))).toHaveValue('confirmed');
});

it('reports a failed Watch action without changing watched state', async () => {
  server.use(http.put(API_BASE_URL + '/api/watchlist/AUDIT', () => HttpResponse.json({ detail: 'watch failed' }, { status: 500 })));
  await user.click(screen.getByRole('button', { name: t('workspacePage.overview.watch') }));
  expect(await screen.findByRole('alert')).toHaveTextContent('watch failed');
});
~~~

Add a Test All HTTP 500 case that keeps the existing source cards and exposes its error.

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- --run src/components/layout/Header.test.tsx src/components/domain/cockpit/SymbolDetailPanel.test.tsx src/pages/DataSources.test.tsx --maxWorkers=1 --minWorkers=1

Expected: requests reach error but no alert describes them.

- [ ] **Step 3: Write minimal implementation**

~~~tsx
{mutation.isError ? <p role="alert" className="text-xs text-danger">{errorMessage}</p> : null}

const healthText = hasActionError
  ? t('header.dataHealth.partial')
  : isFinal ? t('cockpit.strip.finalClose') : t('cockpit.strip.intradayPreview');
~~~

Catch rejected logout() in Header without clearing auth state. Keep strategy select values from confirmed query data. Render watchlist and data-source errors adjacent to their initiators. Use localized generic fallbacks for non-Error values and add only necessary messages.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- --run src/components/layout/Header.test.tsx src/components/domain/cockpit/SymbolDetailPanel.test.tsx src/pages/DataSources.test.tsx --maxWorkers=1 --minWorkers=1

Expected: PASS; alerts remain after settling and the original button/select can be tried again.

- [ ] **Step 5: Commit**

~~~bash
git add web-ui/src/components/layout/Header.tsx web-ui/src/features/strategy/hooks.ts web-ui/src/components/domain/cockpit/SymbolDetailPanel.tsx web-ui/src/pages/DataSources.tsx web-ui/src/i18n/messages.en.ts web-ui/src/components/layout/Header.test.tsx web-ui/src/components/domain/cockpit/SymbolDetailPanel.test.tsx web-ui/src/pages/DataSources.test.tsx
git commit -m "fix: surface failed review actions"
~~~

### Task 5: Repair keyboard, modal, form, and tab interaction

**Files:**
- Modify: web-ui/src/components/common/HelpTooltip.tsx
- Modify: web-ui/src/components/domain/market/CachedSymbolCandleChart.tsx
- Modify: web-ui/src/components/domain/positions/OpenPositionIntelligencePanel.tsx
- Modify: web-ui/src/components/domain/orders/FillViaDegiroModal.tsx
- Modify: web-ui/src/pages/Book.tsx
- Modify: web-ui/src/pages/Universes.tsx
- Modify: web-ui/src/components/domain/universes/UniverseScreenerTab.tsx
- Modify: web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.tsx
- Modify: web-ui/src/i18n/messages.en.ts
- Test: web-ui/src/components/common/HelpTooltip.test.tsx
- Test: web-ui/src/components/domain/market/CachedSymbolCandleChart.test.tsx
- Test: web-ui/src/components/domain/positions/OpenPositionIntelligencePanel.test.tsx
- Test: web-ui/src/components/domain/orders/FillViaDegiroModal.test.tsx
- Test: web-ui/src/pages/Book.test.tsx
- Test: web-ui/src/pages/Universes.test.tsx
- Test: web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx

**Interfaces:**
- Consumes: ModalShell, Field, selection callbacks, and native button semantics.
- Produces: focus-safe dialogs, sibling row actions, keyboard-selectable table rows, labelled weekly fields, and complete Book/Universes tabs.

- [ ] **Step 1: Write failing keyboard and focus regressions**

~~~tsx
it('returns focus to Help after Escape closes its dialog', async () => {
  const { user } = renderWithProviders(<HelpTooltip short="Help" title="Details" content="Body" />);
  const trigger = screen.getByRole('button', { name: 'Help' });
  await user.click(trigger);
  expect(screen.getByRole('dialog')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
});

it('analyzes a position without selecting its symbol', async () => {
  await user.click(screen.getByRole('button', { name: t('todayPage.openPositions.analyzeButton') }));
  expect(analyzePosition).toHaveBeenCalledWith('POS-1');
  expect(onTickerSelect).not.toHaveBeenCalled();
});

it('names weekly textareas through visible Field labels', () => {
  renderWithProviders(<WeeklyReviewForm weekId="2026-W40" />);
  expect(screen.getByLabelText(t('weeklyReview.fields.whatWorked.label'))).toBeInTheDocument();
});
~~~

Add Enter/Space tests for journal, DeGiro, and screener selection and Arrow/Home/End tests for Book and Universes tabs.

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- --run src/components/common/HelpTooltip.test.tsx src/components/domain/market/CachedSymbolCandleChart.test.tsx src/components/domain/positions/OpenPositionIntelligencePanel.test.tsx src/components/domain/orders/FillViaDegiroModal.test.tsx src/pages/Book.test.tsx src/pages/Universes.test.tsx src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx --maxWorkers=1 --minWorkers=1

Expected: dialogs bypass ModalShell, Analyze is nested in a row button, row selection has no keyboard path, fields have no accessible names, and tabs have incomplete semantics.

- [ ] **Step 3: Write minimal implementation**

~~~tsx
<ModalShell title={title} onClose={handleClose} className="max-w-2xl" contentClassName="prose prose-invert max-w-none">
  {content}
</ModalShell>

<Field label={t(field.labelKey)}><Textarea value={form[field.key]} /></Field>

<div role="group" aria-label={t('todayPage.openPositions.rowActions', { ticker: item.ticker })}>
  <button type="button" onClick={() => onTickerSelect(item.ticker)}>...</button>
  <button type="button" onClick={() => analyzeMutation.mutate(item.positionId)}>...</button>
</div>
~~~

Use ModalShell fullScreen in the chart portal. Put native selection buttons in the journal, DeGiro, and screener primary cell; set aria-selected for a selected row. Copy the workspace tab keyboard/ID contract into Book and Universes without a new tabs abstraction.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- --run src/components/common/HelpTooltip.test.tsx src/components/domain/market/CachedSymbolCandleChart.test.tsx src/components/domain/positions/OpenPositionIntelligencePanel.test.tsx src/components/domain/orders/FillViaDegiroModal.test.tsx src/pages/Book.test.tsx src/pages/Universes.test.tsx src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx --maxWorkers=1 --minWorkers=1

Expected: PASS; keyboard actions work, focus returns to triggers, and textareas are found by translated labels.

- [ ] **Step 5: Commit**

~~~bash
git add web-ui/src/components/common/HelpTooltip.tsx web-ui/src/components/domain/market/CachedSymbolCandleChart.tsx web-ui/src/components/domain/positions/OpenPositionIntelligencePanel.tsx web-ui/src/components/domain/orders/FillViaDegiroModal.tsx web-ui/src/pages/Book.tsx web-ui/src/pages/Universes.tsx web-ui/src/components/domain/universes/UniverseScreenerTab.tsx web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.tsx web-ui/src/i18n/messages.en.ts web-ui/src/components/common/HelpTooltip.test.tsx web-ui/src/components/domain/market/CachedSymbolCandleChart.test.tsx web-ui/src/components/domain/positions/OpenPositionIntelligencePanel.test.tsx web-ui/src/components/domain/orders/FillViaDegiroModal.test.tsx web-ui/src/pages/Book.test.tsx web-ui/src/pages/Universes.test.tsx web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx
git commit -m "fix: make review flows keyboard accessible"
~~~

### Task 6: Correct ISO dates, locale/token guardrails, docs, and verification

**Files:**
- Modify: web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.tsx
- Modify: web-ui/src/pages/Calendar.tsx
- Modify: web-ui/src/components/layout/Header.tsx
- Modify: web-ui/src/components/common/HelpTooltip.tsx
- Modify: web-ui/eslint.config.mjs
- Modify: web-ui/src/i18n/messages.en.ts
- Modify: web-ui/docs/WEB_UI_GUIDE.md
- Modify: web-ui/docs/WEB_UI_ARCHITECTURE.md
- Modify: docs/overview/INDEX.md
- Test: web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx
- Test: web-ui/src/pages/Calendar.test.tsx

**Interfaces:**
- Consumes: a Date, I18nProvider locale, all EventSourceTag values, and Tailwind utility classes.
- Produces: correct YYYY-Www ISO IDs, locale-sensitive Calendar dates with an IPO legend, localizable touched copy, directional token lint coverage, and documentation of the changed contracts.

- [ ] **Step 1: Write failing date and locale regressions**

~~~tsx
it.each([
  ['2026-01-05T12:00:00Z', '2026-W02'],
  ['2026-10-01T12:00:00Z', '2026-W40'],
  ['2021-01-01T12:00:00Z', '2020-W53'],
])('returns the ISO week-year for %s', (now, expected) => {
  vi.setSystemTime(new Date(now));
  expect(getCurrentWeekId()).toBe(expected);
});

it('shows an IPO legend and formats dates with the provider locale', () => {
  renderWithProviders(<Calendar />, { locale: 'en-US' });
  expect(screen.getByText(t('calendarPage.legend.ipo'))).toBeInTheDocument();
  expect(screen.getByText('Wed, Oct 1')).toBeInTheDocument();
});
~~~

Use an existing ESLint test harness only if one exists; otherwise use the configured lint command on a temporary fixture outside tracked source to prove directional color utilities are rejected.

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- --run src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx src/pages/Calendar.test.tsx --maxWorkers=1 --minWorkers=1

Expected: the three ISO values are wrong, the IPO legend is missing, and formatting is hardcoded to en-GB.

- [ ] **Step 3: Write minimal implementation**

~~~ts
const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
const isoYear = date.getUTCFullYear();
const week = Math.ceil((((date.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000) + 1) / 7);
return isoYear + '-W' + String(week).padStart(2, '0');

const SOURCE_TAGS: EventSourceTag[] = ['position', 'screener', 'economic', 'ipo'];
~~~

Pass useI18n().locale to Calendar formatting. Replace hover:bg-surface-hover with hover:bg-foreground/5 and replace the tooltip arrow with a semantic token-compatible border. Extend the existing color pattern to match border-t-* and migrate touched Header, HelpTooltip, Weekly Review, and Universe screener copy to message keys.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- --run src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx src/pages/Calendar.test.tsx --maxWorkers=1 --minWorkers=1; npm run lint; npm test -- --run; npm run typecheck; npm run build

Expected: all focused and full tests pass, typecheck has no errors, lint has zero warnings, and Vite completes its production build.

- [ ] **Step 5: Commit**

~~~bash
git add web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.tsx web-ui/src/pages/Calendar.tsx web-ui/src/components/layout/Header.tsx web-ui/src/components/common/HelpTooltip.tsx web-ui/eslint.config.mjs web-ui/src/i18n/messages.en.ts web-ui/src/components/domain/weeklyReview/WeeklyReviewForm.test.tsx web-ui/src/pages/Calendar.test.tsx web-ui/docs/WEB_UI_GUIDE.md web-ui/docs/WEB_UI_ARCHITECTURE.md docs/overview/INDEX.md docs/superpowers/specs/2026-10-01-frontend-remediation-design.md docs/superpowers/plans/2026-10-01-frontend-remediation.md
git commit -m "docs: record frontend remediation contracts"
~~~
