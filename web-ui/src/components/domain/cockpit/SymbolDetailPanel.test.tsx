import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import SymbolDetailPanel from './SymbolDetailPanel';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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

describe('SymbolDetailPanel Approfondisci live wiring', () => {
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
