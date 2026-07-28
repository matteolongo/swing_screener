import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import * as fundamentalsHooks from '@/features/fundamentals/hooks';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import * as catalystHooks from '@/features/intelligence/catalysts/hooks';
import * as intelligenceHooks from '@/features/intelligence/hooks';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import * as screenerHooks from '@/features/screener/hooks';
import * as watchlistHooks from '@/features/watchlist/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import { formatDateTime } from '@/utils/formatters';

vi.mock('@/features/fundamentals/hooks', () => ({
  useFundamentalSnapshotQuery: vi.fn(),
  useRefreshFundamentalSnapshotMutation: vi.fn(),
}));

vi.mock('@/features/intelligence/hooks', () => ({
  useRunTrace: vi.fn(),
  useTickerRuns: vi.fn(),
  findRunByAttemptId: vi.fn(() => null),
  resolveRunId: vi.fn((runs, attemptedRunId, cachedRunId, hasFailedAttempt) => {
    if (hasFailedAttempt) return attemptedRunId;
    return attemptedRunId
      ?? runs?.find((run: { clientAttemptId?: string | null }) => run.clientAttemptId)?.runId
      ?? cachedRunId
      ?? runs?.[0]?.runId
      ?? null;
  }),
  useIntelligenceAnalysisMutation: vi.fn(),
  useEvidenceRefreshMutation: vi.fn(),
  useIntelligenceLatestQuery: vi.fn(),
  useIntelligenceHistoryQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useIntelligenceChatQuery: vi.fn(() => ({ data: { ticker: 'AAPL', chatDate: '2026-07-03', analysisGeneratedAt: '2026-07-03T08:00:00Z', messages: [], refreshedAt: null }, isLoading: false, isError: false })),
  useSendIntelligenceChatMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  usePositionReviewMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null, data: undefined })),
  useStrategicReviewMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null, data: undefined })),
}));

vi.mock('@/features/intelligence/catalysts/hooks', () => ({
  useSymbolCatalystQuery: vi.fn(),
}));

vi.mock('@/features/screener/hooks', () => ({
  useRunScreenerMutation: vi.fn(),
  useTickerCandles: vi.fn(() => ({
    data: undefined,
    dataUpdatedAt: 0,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

vi.mock('@/features/watchlist/hooks', () => ({
  useWatchlist: vi.fn(),
  useWatchSymbolMutation: vi.fn(),
  useUnwatchSymbolMutation: vi.fn(),
}));

vi.mock('@/components/domain/market/CachedSymbolCandleChart', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Chart {ticker}</div>,
}));


function buildSnapshot(): FundamentalSnapshot {
  return {
    symbol: 'AAPL',
    asofDate: '2026-03-19',
    provider: 'yfinance',
    updatedAt: '2026-03-19T10:00:00',
    instrumentType: 'equity',
    supported: true,
    coverageStatus: 'supported',
    freshnessStatus: 'current',
    trailingPe: 24.6,
    priceToSales: 5.1,
    revenueGrowthYoy: 0.042,
    grossMargin: 0.265,
    pillars: {
      growth: { score: 0.9, status: 'strong', summary: 'Growth profile.' },
      profitability: { score: 0.9, status: 'strong', summary: 'Profitability profile.' },
      balance_sheet: { score: 0.9, status: 'strong', summary: 'Balance sheet profile.' },
      cash_flow: { score: 0.9, status: 'strong', summary: 'Cash flow profile.' },
      valuation: { score: 0.55, status: 'neutral', summary: 'Valuation profile.' },
    },
    historicalSeries: {},
    metricContext: {
      trailing_pe: {
        source: 'yfinance.info.trailingPE',
        cadence: 'snapshot',
        derived: false,
        derivedFrom: [],
        periodEnd: '2026-03-19',
      },
      price_to_sales: {
        source: 'yfinance.info.priceToSalesTrailing12Months',
        cadence: 'snapshot',
        derived: false,
        derivedFrom: [],
        periodEnd: '2026-03-19',
      },
      revenue_growth_yoy: {
        source: 'yfinance.info.revenueGrowth',
        cadence: 'snapshot',
        derived: false,
        derivedFrom: [],
        periodEnd: '2025-12-31',
      },
      gross_margin: {
        source: 'yfinance.info.grossMargins',
        cadence: 'snapshot',
        derived: false,
        derivedFrom: [],
        periodEnd: '2025-12-31',
      },
    },
    dataQualityStatus: 'high',
    dataQualityFlags: [],
    redFlags: [],
    highlights: ['Growth metrics are supportive.'],
    metricSources: {},
  };
}

describe('AnalysisCanvasPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(watchlistHooks.useWatchlist).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(watchlistHooks.useWatchSymbolMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as never);
    vi.mocked(watchlistHooks.useUnwatchSymbolMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as never);
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(intelligenceHooks.useIntelligenceAnalysisMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
    vi.mocked(intelligenceHooks.useEvidenceRefreshMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as never);
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(intelligenceHooks.useRunTrace).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(intelligenceHooks.useTickerRuns).mockReturnValue({
      data: [],
      refetch: vi.fn().mockResolvedValue({ data: [] }),
    } as never);
    vi.mocked(catalystHooks.useSymbolCatalystQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'fundamentals',
    });
    useScreenerStore.setState({ lastResult: null });
  });

  const reliabilityFixtures = [
    { name: 'no-data', phase: 'idle', data: undefined, error: null, loading: false, fetching: false, cached: false },
    { name: 'fresh', phase: 'fresh', data: buildSnapshot(), error: null, loading: false, fetching: false, cached: false },
    { name: 'cached', phase: 'cached', data: buildSnapshot(), error: null, loading: false, fetching: false, cached: true },
    { name: 'stale', phase: 'stale', data: { ...buildSnapshot(), freshnessStatus: 'stale' as const }, error: null, loading: false, fetching: false, cached: false },
    { name: 'refreshing-with-data', phase: 'loading', data: buildSnapshot(), error: null, loading: false, fetching: true, cached: false },
    { name: 'partial', phase: 'partial', data: buildSnapshot(), error: new Error('Fundamentals source partial'), loading: false, fetching: false, cached: false },
    { name: 'failed', phase: 'failed', data: undefined, error: new Error('Fundamentals source failed'), loading: false, fetching: false, cached: false },
    { name: 'timeout', phase: 'failed', data: undefined, error: new Error('Fundamentals request timed out'), loading: false, fetching: false, cached: false },
    { name: 'malformed', phase: 'failed', data: undefined, error: new Error('Fundamentals response malformed'), loading: false, fetching: false, cached: false },
  ] as const;
  const reliabilityTabs = ['overview', 'fundamentals', 'intelligence', 'volumeZones'] as const;

  it.each(
    reliabilityTabs.flatMap((tab) =>
      reliabilityFixtures.map((fixture) => ({ tab, fixture })),
    ),
  )('renders $fixture.name state visibly in the $tab tab', ({ tab, fixture }) => {
    useWorkspaceStore.setState({ analysisTab: tab });
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      data: fixture.data,
      dataUpdatedAt: Date.parse('2026-07-27T18:30:00Z'),
      error: fixture.error,
      isError: fixture.error != null,
      isFetching: fixture.fetching,
      isLoading: fixture.loading,
      isFetchedAfterMount: !fixture.cached,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByRole('tabpanel')).toBeVisible();
    expect(screen.getByTestId('workspace-data-status')).toHaveTextContent(
      t(`workspacePage.data.phases.${fixture.phase}`),
    );
    if (fixture.error) {
      expect(screen.getAllByText(fixture.error.message).length).toBeGreaterThan(0);
    }
    if (fixture.fetching && fixture.data) {
      expect(screen.getAllByText(fixture.data.provider).length).toBeGreaterThan(0);
    }
  });

  it('keeps header, failure drawer, and analysis tabs in the keyboard traversal', async () => {
    const failure = new Error('Fundamentals keyboard failure');
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      error: failure,
      isError: true,
      isFetching: false,
      isLoading: false,
      isFetchedAfterMount: true,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);
    const traversedNames: string[] = [];

    for (let index = 0; index < 8; index += 1) {
      await user.tab();
      traversedNames.push(document.activeElement?.getAttribute('aria-label')
        ?? document.activeElement?.textContent?.trim()
        ?? '');
    }

    expect(traversedNames).toEqual([
      t('workspacePage.controls.backToList'),
      t('workspacePage.controls.collapse'),
      t('workspacePage.controls.fullscreen'),
      t('workspacePage.controls.close'),
      t('workspacePage.data.retry'),
      t('workspacePage.data.dismiss'),
      t('workspacePage.panels.analysis.tabs.fundamentals'),
      t('workspacePage.fundamentals.run'),
    ]);
  });

  it('keeps a source refresh scoped while the user switches tabs', async () => {
    let finishRefresh!: (snapshot: FundamentalSnapshot) => void;
    const mutateAsync = vi.fn(
      () => new Promise<FundamentalSnapshot>((resolve) => {
        finishRefresh = resolve;
      }),
    );
    useWorkspaceStore.setState({ analysisTab: 'fundamentals' });
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      data: buildSnapshot(),
      dataUpdatedAt: Date.parse('2026-03-19T10:00:00Z'),
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      isFetchedAfterMount: true,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', { name: t('workspacePage.fundamentals.refresh') }));
    await user.click(screen.getByRole('tab', {
      name: t('workspacePage.panels.analysis.tabs.intelligence'),
    }));

    expect(screen.getByRole('tab', {
      name: t('workspacePage.panels.analysis.tabs.intelligence'),
    })).toHaveAttribute('aria-selected', 'true');
    expect(mutateAsync).toHaveBeenCalledWith('AAPL');

    await act(async () => finishRefresh(buildSnapshot()));
    expect(screen.getByRole('tabpanel')).toBeVisible();
  });

  it('ignores intelligence completion after the workspace unmounts', async () => {
    let callbacks: {
      onSuccess?: (result: SymbolIntelligence) => void;
      onSettled?: () => Promise<void>;
    } = {};
    const mutate = vi.fn((_input, options) => {
      callbacks = options as typeof callbacks;
    });
    useWorkspaceStore.setState({ analysisTab: 'intelligence' });
    vi.mocked(intelligenceHooks.useIntelligenceAnalysisMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user, unmount } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.intelligence.generate'),
    }));
    unmount();
    await act(async () => {
      callbacks.onSuccess?.({
        symbol: 'AAPL',
        generatedAt: '2026-07-28T00:00:00Z',
        action: 'WATCH',
        conviction: 'low',
        catalystUrgency: 'low',
        summaryLine: 'Late result',
        narrative: 'Late result',
        upcomingEvents: [],
        positionSignal: null,
        sources: [],
        evidenceLedger: null,
        classifiedCatalysts: [],
      });
      await callbacks.onSettled?.();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('runs fundamentals analysis for the selected symbol from the canvas', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(buildSnapshot());

    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutateAsync,
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByText(t('workspacePage.fundamentals.noSnapshot'))).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Run fundamentals analysis' }));
    });

    expect(mutateAsync).toHaveBeenCalledWith('AAPL');
  });

  it('renders NarrativeAnalysisCard in the Intelligence tab when latest intelligence has a narrative', async () => {
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    const mockIntelligence: SymbolIntelligence = {
      symbol: 'AAPL',
      generatedAt: '2026-05-26T10:00:00',
      action: 'BUY_NOW',
      conviction: 'high',
      catalystUrgency: 'medium',
      summaryLine: 'AAPL is showing strong momentum with a confirmed breakout.',
      narrative: 'The technical setup is aligned with the trend.',
      upcomingEvents: [
        {
          type: 'earnings',
          date: '2026-07-24',
          direction: 'bullish',
          summary: 'Upcoming earnings may confirm the setup.',
        },
      ],
      positionSignal: null,
      sources: ['yahoo_finance'],
      evidenceLedger: null,
      classifiedCatalysts: [],
    };
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: mockIntelligence,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false, isError: false, data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(), data: undefined, isPending: false, isError: false, error: null,
    } as never);

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.queryByText('AAPL is showing strong momentum with a confirmed breakout.')).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('tab', { name: 'Intelligence' }));
    });

    expect(screen.getAllByText('AAPL is showing strong momentum with a confirmed breakout.')).not.toHaveLength(0);
    // DecisionSummaryCard heading should NOT appear
    expect(screen.queryByText(/AAPL Decision Summary/)).not.toBeInTheDocument();
  });

  it('renders one decision-first overview for the selected screener candidate', () => {
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-03-19',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [
          {
            ticker: 'AAPL',
            currency: 'USD',
            close: 180,
            sma20: 175,
            sma50: 170,
            sma200: 160,
            atr: 3,
            momentum6m: 0.18,
            momentum12m: 0.27,
            relStrength: 0.09,
            score: 0.82,
            confidence: 79,
            rank: 1,
            decisionSummary: {
              symbol: 'AAPL',
              action: 'BUY_NOW',
              conviction: 'high',
              technicalLabel: 'strong',
              fundamentalsLabel: 'strong',
              valuationLabel: 'fair',
              catalystLabel: 'active',
              whyNow: 'Setup timing is ready and business quality supports conviction.',
              whatToDo: 'Use the current trade plan and keep sizing disciplined.',
              mainRisk: 'Valuation remains acceptable, but risk still matters.',
              tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
              valuationContext: { method: 'not_available' },
              drivers: {
                positives: [],
                negatives: [],
                warnings: ['No cached catalyst snapshot is available yet.'],
              },
            },
          },
        ],
      },
    });
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getAllByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'))).toHaveLength(1);
    expect(screen.getByRole('table', { name: t('workspacePage.overview.tradePlan') })).toBeVisible();
  });

  it('renders the catalyst summary before the technical chart in overview', () => {
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-03-19',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [
          {
            ticker: 'AAPL',
            currency: 'USD',
            close: 180,
            sma20: 175,
            sma50: 170,
            sma200: 160,
            atr: 3,
            momentum6m: 0.18,
            momentum12m: 0.27,
            relStrength: 0.09,
            score: 0.82,
            confidence: 79,
            rank: 1,
            decisionSummary: {
              symbol: 'AAPL',
              action: 'BUY_NOW',
              conviction: 'high',
              technicalLabel: 'strong',
              fundamentalsLabel: 'strong',
              valuationLabel: 'fair',
              catalystLabel: 'active',
              whyNow: 'Setup timing is ready.',
              whatToDo: 'Use the current trade plan.',
              mainRisk: 'Risk still matters.',
              tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
              valuationContext: { method: 'not_available' },
              drivers: { positives: [], negatives: [], warnings: [] },
            },
          },
        ],
      },
    });
    vi.mocked(catalystHooks.useSymbolCatalystQuery).mockReturnValue({
      data: {
        symbol: 'AAPL',
        state: 'CATALYST_ACTIVE',
        thesis: 'Unique catalyst thesis marker for ordering',
        keyRisks: [],
        sources: [],
      },
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    const chart = screen.getByText('Chart AAPL');
    const catalyst = screen.getByText('Unique catalyst thesis marker for ordering');
    expect(
      catalyst.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('keeps AI analysis generation inside the Intelligence tab', async () => {
    const mockIntelligence: SymbolIntelligence = {
      symbol: 'AAPL',
      generatedAt: '2026-05-26T10:00:00',
      action: 'BUY_NOW',
      conviction: 'high',
      catalystUrgency: 'medium',
      summaryLine: 'AAPL is showing strong momentum with a confirmed breakout.',
      narrative: '**What to do:** Buy near the planned entry. **Watch for:** Failed follow-through.',
      upcomingEvents: [],
      positionSignal: null,
      sources: ['yahoo_finance'],
      evidenceLedger: null,
      classifiedCatalysts: [],
    };
    const mutate = vi.fn(async (
      _variables: unknown,
      options?: {
        onSuccess?: (result: SymbolIntelligence) => void;
        onSettled?: () => Promise<void>;
      },
    ) => {
      options?.onSuccess?.(mockIntelligence);
      await options?.onSettled?.();
    });
    const refetchRuns = vi.fn().mockResolvedValue({
      data: [{
        runId: 'run-current-attempt',
        ticker: 'AAPL',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'ok',
        durationMs: 1,
        stepCount: 1,
      }],
    });
    vi.mocked(intelligenceHooks.useTickerRuns).mockReturnValue({
      data: [],
      refetch: refetchRuns,
    } as never);
    vi.mocked(intelligenceHooks.findRunByAttemptId).mockReturnValue({
      runId: 'run-current-attempt',
      ticker: 'AAPL',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'ok',
      durationMs: 1,
      stepCount: 1,
    });
    vi.mocked(intelligenceHooks.useIntelligenceAnalysisMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-03-19',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [
          {
            ticker: 'AAPL',
            currency: 'USD',
            close: 180,
            sma20: 175,
            sma50: 170,
            sma200: 160,
            atr: 3,
            momentum6m: 0.18,
            momentum12m: 0.27,
            relStrength: 0.09,
            score: 0.82,
            confidence: 79,
            rank: 1,
            decisionSummary: {
              symbol: 'AAPL',
              action: 'BUY_NOW',
              conviction: 'high',
              technicalLabel: 'strong',
              fundamentalsLabel: 'strong',
              valuationLabel: 'fair',
              catalystLabel: 'active',
              whyNow: 'Setup timing is ready and business quality supports conviction.',
              whatToDo: 'Use the current trade plan and keep sizing disciplined.',
              mainRisk: 'Valuation remains acceptable, but risk still matters.',
              tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
              valuationContext: { method: 'not_available' },
              drivers: {
                positives: [],
                negatives: [],
                warnings: ['No cached catalyst snapshot is available yet.'],
              },
            },
          },
        ],
      },
    });
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.queryByText('AI narrative summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate a web-search-grounded summary/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analyze with AI' })).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('tab', { name: 'Intelligence' }));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: t('workspacePage.intelligence.generate') }));
    });

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL' }),
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    await waitFor(() => {
      expect(intelligenceHooks.useRunTrace).toHaveBeenCalledWith(
        'run-current-attempt',
        true,
      );
    });
    expect(screen.getAllByText('AAPL is showing strong momentum with a confirmed breakout.')).not.toHaveLength(0);
  });

  it('labels the fundamentals summary strip by metric horizon', () => {
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: buildSnapshot(),
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(
      screen.getAllByText(/yfinance · 2026-03-19/i).length
    ).toBeGreaterThan(0);
  });

  it('preserves the historical screener candidate when refreshed fundamentals arrive', () => {
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-03-19',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [
          {
            ticker: 'AAPL',
            currency: 'USD',
            close: 180,
            sma20: 175,
            sma50: 170,
            sma200: 160,
            atr: 3,
            momentum6m: 0.18,
            momentum12m: 0.27,
            relStrength: 0.09,
            score: 0.82,
            confidence: 79,
            rank: 1,
            signal: 'breakout',
            entry: 180,
            stop: 171,
            target: 198,
            rr: 2,
            // No backend decisionSummary yet — triggers local rebuild from fundamentals
            decisionSummary: undefined,
          },
        ],
      },
    });
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: buildSnapshot(),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    const candidate = useScreenerStore.getState().lastResult?.candidates[0];
    expect(candidate?.fundamentalsCoverageStatus).toBeUndefined();
    expect(candidate?.decisionSummary).toBeUndefined();
  });

  it('keeps the canonical decision visible in overview while intelligence is loading', () => {
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-03-19',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [
          {
            ticker: 'AAPL',
            currency: 'USD',
            close: 180,
            sma20: 175,
            sma50: 170,
            sma200: 160,
            atr: 3,
            momentum6m: 0.18,
            momentum12m: 0.27,
            relStrength: 0.09,
            score: 0.82,
            confidence: 79,
            rank: 1,
            decisionSummary: {
              symbol: 'AAPL',
              action: 'BUY_NOW',
              conviction: 'high',
              technicalLabel: 'strong',
              fundamentalsLabel: 'strong',
              valuationLabel: 'fair',
              catalystLabel: 'active',
              whyNow: 'Setup timing is ready and business quality supports conviction.',
              whatToDo: 'Use the current trade plan and keep sizing disciplined.',
              mainRisk: 'Valuation remains acceptable, but risk still matters.',
              tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
              valuationContext: { method: 'not_available' },
              drivers: {
                positives: [],
                negatives: [],
                warnings: ['No cached catalyst snapshot is available yet.'],
              },
            },
          },
        ],
      },
    });
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    } as never);
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'))).toBeVisible();
  });

  it('does not render BeginnerDecisionHeader in overview when decisionSummary is present', () => {
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-03-19',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [
          {
            ticker: 'AAPL',
            currency: 'USD',
            close: 180,
            sma20: 175,
            sma50: 170,
            sma200: 160,
            atr: 3,
            momentum6m: 0.18,
            momentum12m: 0.27,
            relStrength: 0.09,
            score: 0.82,
            confidence: 79,
            rank: 1,
            decisionSummary: {
              symbol: 'AAPL',
              action: 'BUY_NOW',
              conviction: 'high',
              technicalLabel: 'strong',
              fundamentalsLabel: 'strong',
              valuationLabel: 'fair',
              catalystLabel: 'active',
              whyNow: 'Setup timing is ready and business quality supports conviction.',
              whatToDo: 'Use the current trade plan and keep sizing disciplined.',
              mainRisk: 'Valuation remains acceptable, but risk still matters.',
              tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
              valuationContext: { method: 'not_available' },
              drivers: {
                positives: [],
                negatives: [],
                warnings: ['No cached catalyst snapshot is available yet.'],
              },
            },
          },
        ],
      },
    });
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.queryByText('Should I place an order?')).not.toBeInTheDocument();
  });

  it('keeps the full AI analysis section out of overview', () => {
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-03-19',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [
          {
            ticker: 'AAPL',
            currency: 'USD',
            close: 180,
            sma20: 175,
            sma50: 170,
            sma200: 160,
            atr: 3,
            momentum6m: 0.18,
            momentum12m: 0.27,
            relStrength: 0.09,
            score: 0.82,
            confidence: 79,
            rank: 1,
            decisionSummary: {
              symbol: 'AAPL',
              action: 'BUY_NOW',
              conviction: 'high',
              technicalLabel: 'strong',
              fundamentalsLabel: 'strong',
              valuationLabel: 'fair',
              catalystLabel: 'active',
              whyNow: 'Breakout from a multi-week base.',
              whatToDo: 'Place a stop-buy above the pivot.',
              mainRisk: 'Earnings in 5 days.',
              tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
              valuationContext: { method: 'not_available' },
              drivers: { positives: [], negatives: [], warnings: [] },
            },
          },
        ],
      },
    });
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: {
        symbol: 'AAPL',
        generatedAt: '2026-05-26T10:00:00',
        action: 'BUY_NOW',
        conviction: 'high',
        catalystUrgency: 'medium',
        summaryLine: 'AAPL setup confirmed.',
        narrative: 'Strong momentum aligns with the breakout.',
        upcomingEvents: [],
        positionSignal: null,
        sources: [],
      },
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false, isError: false, data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(), data: undefined, isPending: false, isError: false, error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByText(t('workspacePage.overview.decisionRationale'))).toBeInTheDocument();
    // NarrativeAnalysisCard renders "{symbol} — AI analysis" in a <span>
    const aiTitle = screen.queryByText((_content, el) =>
      el?.tagName === 'SPAN' &&
      (el?.textContent?.includes(t('workspacePage.panels.analysis.intelligence.aiAnalysisTitle')) ?? false)
    );
    expect(aiTitle).not.toBeInTheDocument();
  });

  it('hides the Analyze with AI button from overview for a held position with no screener candidate', async () => {
    // VALE is an open position in the default MSW handler, with no screener candidate cached.
    useWorkspaceStore.setState({
      selectedTicker: 'VALE',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({ lastResult: null });
    mockFundamentalsIdle();

    renderWithProviders(<AnalysisCanvasPanel />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: t('workspacePage.panels.analysis.intelligence.analyzeAction') })).not.toBeInTheDocument();
    });
  });

  it('auto-computes a live candidate for a held position with no screener candidate', async () => {
    // VALE is an open position in the default MSW handler, with no cached candidate.
    const mutate = vi.fn();
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({
      mutate, isPending: false, isError: false, error: null,
    } as never);
    useWorkspaceStore.setState({
      selectedTicker: 'VALE',
      selectedTickerSource: 'screener',
      analysisTab: 'overview',
    });
    useScreenerStore.setState({ lastResult: null });
    mockFundamentalsIdle();

    renderWithProviders(<AnalysisCanvasPanel />);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ tickers: ['VALE'], includeHeld: true })
      );
    });
  });

  it('renders a watch toggle for the selected symbol', () => {
    useWorkspaceStore.setState({ analysisTab: 'overview' });
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByRole('button', { name: 'Watch' })).toBeInTheDocument();
  });

  it('fundamentals tab: does not render a standalone refresh card with ticker heading', () => {
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: buildSnapshot(),
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.queryByRole('heading', { name: 'AAPL', level: 3 })).not.toBeInTheDocument();
  });

  it('fundamentals tab: provider activity is hidden by default', () => {
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: buildSnapshot(),
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(
      screen.queryByText(
        t('workspacePage.fundamentals.providerActivity', { provider: 'yfinance' }),
      ),
    ).not.toBeInTheDocument();
  });

  it('fundamentals tab: reveals provider activity on request', async () => {
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: buildSnapshot(),
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(
      screen.getByRole('button', { name: t('workspacePage.data.showActivity') }),
    );
    expect(
      screen.getByText(
        t('workspacePage.fundamentals.providerActivity', { provider: 'yfinance' }),
      ),
    ).toBeVisible();
  });

  it('fundamentals tab: shows a refresh button in the compact row', () => {
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: buildSnapshot(),
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('fundamentals tab: shows updated timestamp when snapshot exists', () => {
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: buildSnapshot(),
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByText(formatDateTime(buildSnapshot().updatedAt))).toBeInTheDocument();
  });
});

function mockFundamentalsIdle() {
  vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
    isLoading: false,
    isError: false,
    data: undefined,
  } as never);
  vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
    mutate: vi.fn(),
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
  } as never);
}

describe('AnalysisCanvasPanel — compute analysis button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(watchlistHooks.useWatchlist).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(watchlistHooks.useWatchSymbolMutation).mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined } as never);
    vi.mocked(watchlistHooks.useUnwatchSymbolMutation).mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined } as never);
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as never);
    vi.mocked(intelligenceHooks.useIntelligenceAnalysisMutation).mockReturnValue({
      mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn(),
    } as never);
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: undefined, isLoading: false, isError: false,
    } as never);
    mockFundamentalsIdle();
    useWorkspaceStore.setState({ selectedTicker: 'ENI.MI', selectedTickerSource: null, analysisTab: 'overview' });
    useScreenerStore.setState({ lastResult: null });
  });

  it('shows compute button when ticker has no screener data at all', () => {
    renderWithProviders(<AnalysisCanvasPanel />);
    expect(screen.getByRole('button', { name: 'Compute analysis' })).toBeInTheDocument();
    expect(screen.getByText(/No screener analysis is cached for ENI.MI yet/)).toBeInTheDocument();
  });

  it('shows compute button when screener result exists but does not include the selected ticker', () => {
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-05-18',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [{ ticker: 'AAPL', currency: 'USD', close: 180, sma20: 175, sma50: 170, sma200: 160, atr: 3, momentum6m: 0.1, momentum12m: 0.2, relStrength: 0.05, score: 0.7, confidence: 65, rank: 1 }],
      },
    });
    renderWithProviders(<AnalysisCanvasPanel />);
    expect(screen.getByRole('button', { name: 'Compute analysis' })).toBeInTheDocument();
  });

  it('does not show compute button when the ticker is already in the screener result', () => {
    useWorkspaceStore.setState({ selectedTicker: 'AAPL', selectedTickerSource: 'screener', analysisTab: 'overview' });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-05-18',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [{ ticker: 'AAPL', currency: 'USD', close: 180, sma20: 175, sma50: 170, sma200: 160, atr: 3, momentum6m: 0.1, momentum12m: 0.2, relStrength: 0.05, score: 0.7, confidence: 65, rank: 1 }],
      },
    });
    renderWithProviders(<AnalysisCanvasPanel />);
    expect(screen.queryByRole('button', { name: 'Compute analysis' })).not.toBeInTheDocument();
  });

  it('calls screener mutation with the selected ticker when compute button is clicked', async () => {
    const mutate = vi.fn();
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({ mutate, isPending: false, isError: false, error: null } as never);

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Compute analysis' }));
    });

    expect(mutate).toHaveBeenCalledWith({ tickers: ['ENI.MI'], top: 1, includeHeld: true });
  });

  it('shows loading text and disables button while the mutation is pending', () => {
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({ mutate: vi.fn(), isPending: true, isError: false, error: null } as never);

    renderWithProviders(<AnalysisCanvasPanel />);
    expect(screen.getByRole('button', { name: 'Computing...' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Compute analysis' })).not.toBeInTheDocument();
  });

  it('shows error message when the mutation fails', () => {
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error('network error'),
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);
    expect(screen.getByText('network error')).toBeInTheDocument();
  });
});
