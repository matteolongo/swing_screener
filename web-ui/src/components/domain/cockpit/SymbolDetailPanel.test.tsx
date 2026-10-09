import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import SymbolDetailPanel from './SymbolDetailPanel';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { mockScreenerResults } from '@/test/mocks/handlers';

function eligibleAdyenCandidate(name = 'Adyen N.V.') {
  return {
    ticker: 'ADYEN',
    name,
    currency: 'EUR',
    close: 1400,
    sma20: null,
    sma50: null,
    sma200: null,
    atr: 25,
    momentum6m: 0,
    momentum12m: 0,
    relStrength: 0,
    score: 0.9,
    confidence: 90,
    rank: 1,
    technicalRank: 1,
    priorityRank: 1,
    rr: 2,
    entry: 1400,
    stop: 1330,
    target: 1540,
    executionEligibility: { allowed: true, mode: 'ready', reason: null },
    canonicalOrderDraft: {
      orderType: 'BUY_LIMIT',
      entry: 1400,
      stop: 1330,
      target: 1540,
      shares: 2,
      rr: 2,
      quoteCurrency: 'EUR',
      approvalToken: 'tok-adyen-1',
    },
    recommendation: {
      verdict: 'RECOMMENDED',
      reasonsShort: [],
      reasonsDetailed: [],
      risk: { entry: 1400, stop: 1330, target: 1540, shares: 2, riskAmount: 140, riskPct: 0.01, positionSize: 2800 },
      costs: { commissionEstimate: 0, fxEstimate: 0, slippageEstimate: 0, totalCost: 0 },
      checklist: [],
      education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
      workflowStatus: 'ready',
      nextStep: { code: 'review_order' },
    },
    decisionSummary: {
      symbol: 'ADYEN',
      action: 'BUY_NOW',
      conviction: 'high',
      technicalLabel: 'strong',
      fundamentalsLabel: 'strong',
      valuationLabel: 'fair',
      catalystLabel: 'active',
      whyNow: 'Breakout from a multi-week base.',
      whatToDo: 'Review the proposed order.',
      mainRisk: 'Earnings in 5 days.',
      tradePlan: { entry: 1400, stop: 1330, target: 1540, rr: 2 },
      valuationContext: { method: 'not_available' },
      drivers: { positives: [], negatives: [], warnings: [] },
    },
  } as never;
}

function seedSelectionPinnedFirst(candidateName: string, lastResultName: string | null) {
  const candidate = eligibleAdyenCandidate(candidateName);
  useScreenerStore.setState({
    todayRun: null,
    lastRunContext: null,
    todayRunInitialized: true,
    lastResult: lastResultName
      ? ({
          asofDate: '2026-09-16',
          totalScreened: 1,
          totalWithMarketData: 1,
          totalRankedCandidates: 1,
          totalReturnedCandidates: 1,
          dataFreshness: 'final_close',
          candidates: [eligibleAdyenCandidate(lastResultName)],
        } as never)
      : null,
  });
  useWorkspaceStore.setState({
    selection: null,
    selectedTicker: null,
    selectedTickerSource: null,
    selectionVersion: 0,
    analysisTab: 'overview',
  });
  useWorkspaceStore.getState().setWorkspaceSelection({
    ticker: 'ADYEN',
    source: 'today_run',
    runId: 'pinned-run',
    rowId: 'today_run:pinned-run:ADYEN',
    candidate,
  });
}

describe('SymbolDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedSelectionPinnedFirst('Adyen N.V.', null);
  });

  it('refreshes the selected candidate without replacing the saved run or selection', async () => {
    seedSelectionPinnedFirst('Pinned Adyen N.V.', 'Last Run Adyen');
    const savedRun = useScreenerStore.getState().lastResult;
    const savedSelection = useWorkspaceStore.getState().selection;
    let requestBody: unknown;
    server.use(http.post(`${API_BASE_URL}/api/screener/run`, async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json({ ...mockScreenerResults, candidates: [{ ...mockScreenerResults.candidates[0], ticker: 'ADYEN', name: 'Refreshed Adyen', close: 1500, entry: 1500 }] });
    }));
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: t('recommendation.workflow.nextStep.refresh_data') }));
    expect(await screen.findByText('Refreshed Adyen')).toBeVisible();
    expect(requestBody).toMatchObject({ tickers: ['ADYEN'], top: 1, include_held: true, force_refresh: true });
    expect(useScreenerStore.getState().lastResult).toBe(savedRun);
    expect(useWorkspaceStore.getState().selection).toBe(savedSelection);
  });

  it('retains the selected candidate on a failed refresh and allows retry', async () => {
    let fail = true;
    server.use(http.post(`${API_BASE_URL}/api/screener/run`, () => fail
      ? HttpResponse.json({ detail: 'Candidate refresh unavailable' }, { status: 503 })
      : HttpResponse.json({ ...mockScreenerResults, candidates: [{ ...mockScreenerResults.candidates[0], ticker: 'ADYEN', name: 'Refreshed Adyen' }] })));
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    const button = screen.getByRole('button', { name: t('recommendation.workflow.nextStep.refresh_data') });
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Candidate refresh unavailable');
    expect(screen.getByText('Adyen N.V.')).toBeVisible();
    fail = false;
    await user.click(button);
    expect(await screen.findByText('Refreshed Adyen')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('preserves the selected run filters while refreshing the latest session', async () => {
    const selection = useWorkspaceStore.getState().selection!;
    useScreenerStore.setState({
      todayRun: {
        completedAt: selection.runId!,
        request: { minPrice: 5, maxPrice: 2000, currencies: ['EUR'], breakoutLookback: 63, asofDate: '2026-09-01' },
        displayFilters: { recommendedOnly: false, actionFilter: 'all' },
        result: { asofDate: '2026-09-01', totalScreened: 1, dataFreshness: 'final_close', candidates: [eligibleAdyenCandidate()] },
      },
      lastRunContext: { completedAt: 'unrelated-run', request: { maxPrice: 120 }, displayFilters: { recommendedOnly: false, actionFilter: 'all' } },
    });
    let requestBody: Record<string, unknown> = {};
    server.use(http.post(`${API_BASE_URL}/api/screener/run`, async ({ request }) => {
      requestBody = await request.json() as Record<string, unknown>;
      const candidates = requestBody.max_price === 2000
        ? [{ ...mockScreenerResults.candidates[0], ticker: 'ADYEN', name: 'Current Adyen' }]
        : [];
      return HttpResponse.json({ ...mockScreenerResults, candidates });
    }));
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: t('recommendation.workflow.nextStep.refresh_data') }));
    expect(await screen.findByText('Current Adyen')).toBeVisible();
    expect(requestBody).toMatchObject({ min_price: 5, max_price: 2000, currencies: ['EUR'], breakout_lookback: 63 });
    expect(requestBody).not.toHaveProperty('asof_date');
  });

  it.each([{ candidates: [] }, { candidates: [{ ...mockScreenerResults.candidates[0], ticker: 'MSFT' }] }])('rejects a refresh without the requested candidate', async ({ candidates }) => {
    server.use(http.post(`${API_BASE_URL}/api/screener/run`, () => HttpResponse.json({ ...mockScreenerResults, candidates })));
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: t('recommendation.workflow.nextStep.refresh_data') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('workspacePage.panels.analysis.computeAnalysis.noCandidate', { ticker: 'ADYEN' }));
    expect(screen.getByText('Adyen N.V.')).toBeVisible();
  });

  it('discards a late refresh when another run of the same ticker is selected', async () => {
    let started = false;
    let release!: () => void;
    const responseReady = new Promise<void>((resolve) => { release = resolve; });
    server.use(http.post(`${API_BASE_URL}/api/screener/run`, async () => {
      started = true;
      await responseReady;
      return HttpResponse.json({ ...mockScreenerResults, candidates: [{ ...mockScreenerResults.candidates[0], ticker: 'ADYEN', name: 'Late Adyen' }] });
    }));
    const { user, queryClient } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: t('recommendation.workflow.nextStep.refresh_data') }));
    await waitFor(() => expect(started).toBe(true));
    act(() => useWorkspaceStore.getState().setWorkspaceSelection({ ticker: 'ADYEN', source: 'last_run', runId: 'other-run', rowId: 'other-run:ADYEN', candidate: eligibleAdyenCandidate('Other selected Adyen') }));
    release();
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(screen.getByText('Other selected Adyen')).toBeVisible();
    expect(screen.queryByText('Late Adyen')).not.toBeInTheDocument();
  });

  it('renders action, chart and AI summary blocks in order', () => {
    renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    const panel = screen.getByTestId('symbol-detail-panel');
    const headings = within(panel).getAllByRole('heading', { level: 2 });
    const texts = headings.map((h) => h.textContent);
    // AnalysisDecisionStrip owns its own ticker <h2>, so assert relative order
    // of the three cockpit section headings rather than exclusivity.
    const idxAction = texts.indexOf(t('cockpit.detail.action'));
    const idxChart = texts.indexOf(t('cockpit.detail.chart'));
    const idxAi = texts.indexOf(t('cockpit.detail.ai'));
    expect(idxAction).toBeGreaterThanOrEqual(0);
    expect(idxChart).toBeGreaterThan(idxAction);
    expect(idxAi).toBeGreaterThan(idxChart);
    expect(screen.getByRole('button', { name: t('cockpit.detail.close') })).toBeInTheDocument();
  });

  it('shows the existing order-review entry point plus manual-execution microcopy', () => {
    renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    expect(
      screen.getByRole('button', { name: t('analysis.prepareOrder') }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('cockpit.detail.manualNote'))).toBeInTheDocument();
  });

  it('opens the signed order review when prepare order is clicked', async () => {
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: t('analysis.prepareOrder') }));
    expect(await screen.findByRole('heading', { name: t('order.review.formTitle') })).toBeInTheDocument();
  });

  it('uses the workspace selection snapshot instead of re-querying Last Run by ticker', () => {
    seedSelectionPinnedFirst('Pinned Adyen N.V.', 'New Last Run Adyen');
    renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    expect(screen.getByText('Pinned Adyen N.V.')).toBeInTheDocument();
    expect(screen.queryByText('New Last Run Adyen')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: t('cockpit.detail.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reports a failed Watch action without changing watched state', async () => {
    server.use(
      http.put(`${API_BASE_URL}/api/watchlist/ADYEN`, () =>
        HttpResponse.json({ detail: 'watch failed' }, { status: 500 })),
    );
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: t('workspacePage.overview.watch') }));

    expect(await screen.findByRole('alert')).toHaveTextContent('watch failed');
    expect(screen.getByRole('button', { name: t('workspacePage.overview.watch') })).toBeInTheDocument();
  });
});

function adyenIntelligenceApi(generatedAt: string, summaryLine: string) {
  return {
    symbol: 'ADYEN',
    generated_at: generatedAt,
    run_id: null,
    action: 'WATCH',
    conviction: 'medium',
    catalyst_urgency: 'low',
    summary_line: summaryLine,
    narrative: 'Narrative body for ADYEN.',
    upcoming_events: [],
    position_signal: null,
    sources: ['mock'],
  };
}

function adyenFundamentalsApi(updatedAt: string) {
  return {
    symbol: 'ADYEN',
    asof_date: '2026-09-16',
    provider: 'sec_edgar',
    updated_at: updatedAt,
    instrument_type: 'equity',
    supported: true,
    coverage_status: 'supported',
    freshness_status: 'current',
    company_name: 'Adyen N.V.',
  };
}

describe('SymbolDetailPanel Today refresh scope', () => {
  it.each(['today_watchlist', 'today_position'] as const)('refreshes a %s symbol outside the pinned scan', async (source) => {
    seedSelectionPinnedFirst('Adyen N.V.', null);
    useWorkspaceStore.getState().setWorkspaceSelection({ ticker: 'ADYEN', source, rowId: `${source}:ADYEN` });
    let requestBody: unknown;
    server.use(http.post(`${API_BASE_URL}/api/screener/run`, async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json({ ...mockScreenerResults, candidates: [{ ...mockScreenerResults.candidates[0], ticker: 'ADYEN', name: 'Fresh watchlist Adyen' }] });
    }));
    const onRefreshToday = vi.fn();
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} onRefreshToday={onRefreshToday} />);
    await user.click(screen.getByRole('button', { name: t('recommendation.workflow.nextStep.refresh_data') }));
    expect(await screen.findByText('Fresh watchlist Adyen')).toBeVisible();
    expect(requestBody).toMatchObject({ tickers: ['ADYEN'], include_held: true, force_refresh: true });
  });
});

describe('SymbolDetailPanel Approfondisci live wiring', () => {
  beforeEach(() => seedSelectionPinnedFirst('Adyen N.V.', null));
  it('generates analysis from the Approfondisci tab through the live intelligence endpoint', async () => {
    let postCount = 0;
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/ADYEN/runs`, () =>
        HttpResponse.json({ entries: [] }),
      ),
      http.get(`${API_BASE_URL}/api/intelligence/ADYEN/chat`, () =>
        HttpResponse.json({
          ticker: 'ADYEN',
          chat_date: '2026-09-17',
          analysis_generated_at: '2026-09-17T10:00:00Z',
          messages: [],
        }),
      ),
      http.post(`${API_BASE_URL}/api/intelligence/ADYEN`, () => {
        postCount += 1;
        return HttpResponse.json(
          adyenIntelligenceApi('2026-09-17T10:00:00Z', 'Freshly generated ADYEN analysis.'),
        );
      }),
    );
    const { user } = renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    await user.click(
      screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.intelligence') }),
    );
    await user.click(
      screen.getByRole('button', { name: t('workspacePage.intelligence.generate') }),
    );
    expect(await screen.findAllByText('Freshly generated ADYEN analysis.')).not.toHaveLength(0);
    expect(postCount).toBe(1);
  });
});

describe('SymbolDetailPanel AI stale badge', () => {
  beforeEach(() => seedSelectionPinnedFirst('Adyen N.V.', null));
  it('does not label a missing analysis as outdated', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/fundamentals/snapshot/ADYEN`, () =>
        HttpResponse.json(adyenFundamentalsApi('2026-09-17T10:00:00Z'))),
      http.get(`${API_BASE_URL}/api/intelligence/ADYEN/latest`, () =>
        HttpResponse.json(null)),
    );
    renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    expect(await screen.findByText(t('workspacePage.intelligence.empty'))).toBeInTheDocument();
    expect(screen.queryByText(t('cockpit.detail.aiStale'))).not.toBeInTheDocument();
  });
  it('marks cached analysis outdated when the selected daily bar is newer', async () => {
    seedSelectionPinnedFirst('Adyen N.V.', null);
    const selection = useWorkspaceStore.getState().selection!;
    useWorkspaceStore.getState().setWorkspaceSelection({
      ...selection,
      candidate: { ...selection.candidate!, lastBar: '2026-09-18' },
    });
    server.use(
      http.get(`${API_BASE_URL}/api/fundamentals/snapshot/ADYEN`, () =>
        HttpResponse.json(adyenFundamentalsApi('2026-09-15T10:00:00Z'))),
      http.get(`${API_BASE_URL}/api/intelligence/ADYEN/latest`, () =>
        HttpResponse.json(adyenIntelligenceApi('2026-09-16T10:00:00Z', 'Cached ADYEN summary.'))),
    );
    renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    expect(await screen.findByText(t('cockpit.detail.aiStale'))).toBeInTheDocument();
  });

  it('shows the stale badge when the fundamentals snapshot is newer than the cached analysis', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/fundamentals/snapshot/ADYEN`, () =>
        HttpResponse.json(adyenFundamentalsApi('2026-09-17T10:00:00Z')),
      ),
      http.get(`${API_BASE_URL}/api/intelligence/ADYEN/latest`, () =>
        HttpResponse.json(adyenIntelligenceApi('2026-09-16T10:00:00Z', 'Cached ADYEN summary.')),
      ),
    );
    renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    expect(await screen.findByText(t('cockpit.detail.aiStale'))).toBeInTheDocument();
  });

  it('hides the stale badge when the cached analysis is newer than the fundamentals snapshot', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/fundamentals/snapshot/ADYEN`, () =>
        HttpResponse.json(adyenFundamentalsApi('2026-09-15T10:00:00Z')),
      ),
      http.get(`${API_BASE_URL}/api/intelligence/ADYEN/latest`, () =>
        HttpResponse.json(adyenIntelligenceApi('2026-09-16T10:00:00Z', 'Cached ADYEN summary.')),
      ),
    );
    renderWithProviders(<SymbolDetailPanel ticker="ADYEN" onClose={() => {}} />);
    expect(await screen.findAllByText('Cached ADYEN summary.')).not.toHaveLength(0);
    expect(screen.queryByText(t('cockpit.detail.aiStale'))).not.toBeInTheDocument();
  });
});
