import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import * as fundamentalsHooks from '@/features/fundamentals/hooks';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import * as catalystHooks from '@/features/intelligence/catalysts/hooks';
import * as intelligenceHooks from '@/features/intelligence/hooks';
import type { EvidenceRefreshResponse, SymbolIntelligence } from '@/features/intelligence/types';
import * as screenerHooks from '@/features/screener/hooks';
import * as portfolioHooks from '@/features/portfolio/hooks';
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
  useLatestEvidenceSummaryQuery: vi.fn(() => ({
    data: undefined,
    dataUpdatedAt: 0,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
  })),
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

vi.mock('@/features/portfolio/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/portfolio/hooks')>(),
  useOpenPositions: vi.fn(),
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
  const selectStoredCandidate = (source: 'today_run' | 'last_run' = 'last_run') => {
    const candidate = useScreenerStore.getState().lastResult?.candidates[0];
    if (!candidate) throw new Error('Expected a screener candidate');
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: candidate.ticker,
      source,
      runId: `${source}-fixture`,
      rowId: `${source}-fixture:${candidate.ticker}`,
      candidate,
    });
  };

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
    vi.mocked(portfolioHooks.useOpenPositions).mockReturnValue({ data: [] } as never);
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
      selection: null,
      analysisTab: 'fundamentals',
      selectionVersion: 1,
      activities: [],
      activityDrawerOpen: false,
    });
    useScreenerStore.setState({ lastResult: null });
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
    useWorkspaceStore.getState().beginActivity({
      requestId: 'fundamentals-keyboard-failure',
      ticker: 'AAPL',
      selectionVersion: 1,
      sourceId: 'fundamentals',
      phase: 'active',
      startedAt: '2026-07-29T09:00:00Z',
      finishedAt: null,
      provider: null,
      message: null,
      retryable: false,
      pipelineStep: 'refresh-fundamentals',
      announced: false,
    });
    useWorkspaceStore.getState().settleActivity('fundamentals-keyboard-failure', {
      phase: 'failed',
      finishedAt: '2026-07-29T09:01:00Z',
      message: failure.message,
      retryable: true,
    });
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);
    const traversedNames: string[] = [];

    for (let index = 0; index < 20; index += 1) {
      await user.tab();
      traversedNames.push(document.activeElement?.getAttribute('aria-label')
        ?? document.activeElement?.textContent?.trim()
        ?? '');
    }

    expect(traversedNames).toEqual(expect.arrayContaining([
      t('workspacePage.controls.backToList'),
      t('workspacePage.controls.refreshAll'),
      t('workspacePage.controls.collapse'),
      t('workspacePage.controls.fullscreen'),
      t('workspacePage.controls.close'),
      t('workspacePage.data.sources.screener'),
      t('workspacePage.data.sources.prices'),
      t('workspacePage.data.sources.fundamentals'),
      t('workspacePage.data.sources.evidence'),
      t('workspacePage.data.sources.intelligence'),
      t('workspacePage.data.sources.positionOrders'),
      t('workspacePage.data.retryActivity', {
        source: t('workspacePage.data.sources.fundamentals'),
        ticker: 'AAPL',
      }),
      t('workspacePage.data.dismissActivity', {
        source: t('workspacePage.data.sources.fundamentals'),
        ticker: 'AAPL',
      }),
      t('workspacePage.panels.analysis.tabs.fundamentals'),
      t('workspacePage.fundamentals.run'),
    ]));
  });

  it('keeps refresh-all enabled while only intelligence is loading', async () => {
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      data: buildSnapshot(),
      dataUpdatedAt: Date.parse('2026-03-19T10:00:00Z'),
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      isFetchedAfterMount: true,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      error: null,
      dataUpdatedAt: 0,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    await waitFor(() => expect(screen.getByRole('button', {
      name: t('workspacePage.controls.refreshAll'),
    })).toBeEnabled());
  });

  it('shows activity only for the active ticker and selection version', () => {
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
    const baseActivity = {
      sourceId: 'prices' as const,
      phase: 'failed' as const,
      startedAt: '2026-07-29T09:00:00Z',
      finishedAt: '2026-07-29T09:01:00Z',
      provider: null,
      message: 'Unavailable',
      retryable: true,
      pipelineStep: 'fetch-prices',
      announced: true,
    };
    useWorkspaceStore.setState({
      activityDrawerOpen: true,
      activities: [
        { ...baseActivity, requestId: 'old-msft', ticker: 'MSFT', selectionVersion: 0 },
        { ...baseActivity, requestId: 'current-aapl', ticker: 'AAPL', selectionVersion: 1 },
      ],
    });

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('current-aapl');
    expect(screen.getByRole('status')).not.toHaveTextContent('old-msft');
  });

  it('keeps refresh-all disabled until its fundamentals mutation completes', async () => {
    let finishRefresh!: (snapshot: FundamentalSnapshot) => void;
    const mutateAsync = vi.fn(
      () => new Promise<FundamentalSnapshot>((resolve) => {
        finishRefresh = resolve;
      }),
    );
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      data: buildSnapshot(),
      dataUpdatedAt: Date.parse('2026-03-19T10:00:00Z'),
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      isFetchedAfterMount: true,
    } as never);
    const mutationResult = {
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    };
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation)
      .mockImplementation(() => mutationResult as never);
    const { user, rerender } = renderWithProviders(<AnalysisCanvasPanel />);
    const refreshAll = await screen.findByRole('button', {
      name: t('workspacePage.controls.refreshAll'),
    });
    await waitFor(() => expect(refreshAll).toBeEnabled());

    await user.click(refreshAll);
    mutationResult.isPending = true;
    rerender(<AnalysisCanvasPanel />);

    expect(refreshAll).toBeDisabled();
    await user.click(refreshAll);
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => finishRefresh(buildSnapshot()));
    mutationResult.isPending = false;
    rerender(<AnalysisCanvasPanel />);
    await waitFor(() => expect(refreshAll).toBeEnabled());
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

  it('tracks a retried prices request from active through completed', async () => {
    let finishRefresh!: () => void;
    const candles = { isFetching: false };
    const refetch = vi.fn(() => new Promise<void>((resolve) => {
      candles.isFetching = true;
      finishRefresh = () => {
        candles.isFetching = false;
        resolve();
      };
    }));
    vi.mocked(screenerHooks.useTickerCandles).mockImplementation(() => ({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      isError: false,
      isFetching: candles.isFetching,
      isLoading: false,
      refetch,
    } as never));
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
    useWorkspaceStore.setState({
      activityDrawerOpen: true,
      activities: [{
        requestId: 'failed-prices',
        ticker: 'AAPL',
        selectionVersion: 1,
        sourceId: 'prices',
        phase: 'failed',
        startedAt: '2026-07-29T09:00:00Z',
        finishedAt: '2026-07-29T09:01:00Z',
        provider: 'polygon',
        message: 'Price history unavailable',
        retryable: true,
        pipelineStep: 'fetch-candles',
        announced: true,
      }],
    });
    const { user, rerender } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.data.retryActivity', {
        source: t('workspacePage.data.sources.prices'),
        ticker: 'AAPL',
      }),
    }));
    rerender(<AnalysisCanvasPanel />);

    expect(useWorkspaceStore.getState().activities[0]).toMatchObject({
      sourceId: 'prices',
      phase: 'active',
    });
    await act(async () => finishRefresh());
    rerender(<AnalysisCanvasPanel />);
    await waitFor(() => expect(useWorkspaceStore.getState().activities[0].phase).toBe('completed'));
  });

  it('handles a rejected source retry at the UI command boundary', async () => {
    const refetch = vi.fn().mockRejectedValue(new Error('prices unavailable'));
    vi.mocked(screenerHooks.useTickerCandles).mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      error: new Error('prices unavailable'),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch,
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
    useWorkspaceStore.setState({
      activityDrawerOpen: true,
      activities: [{
        requestId: 'failed-prices',
        ticker: 'AAPL',
        selectionVersion: 1,
        sourceId: 'prices',
        phase: 'failed',
        startedAt: '2026-07-29T09:00:00Z',
        finishedAt: '2026-07-29T09:01:00Z',
        provider: 'polygon',
        message: 'Price history unavailable',
        retryable: true,
        pipelineStep: 'fetch-prices',
        announced: true,
      }],
    });
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.data.retryActivity', {
        source: t('workspacePage.data.sources.prices'),
        ticker: 'AAPL',
      }),
    }));
    await waitFor(() => expect(refetch).toHaveBeenCalledWith({ throwOnError: true }));

    expect(screen.getByRole('status')).toHaveTextContent('Price history unavailable');
  });

  it('records a late intelligence result from an older selection as discarded', async () => {
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
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.intelligence.generate'),
    }));
    expect(useWorkspaceStore.getState().activities[0]?.phase).toBe('active');

    act(() => useWorkspaceStore.getState().setSelectedTicker('MSFT'));
    await act(async () => {
      callbacks.onSuccess?.({
        symbol: 'AAPL',
        generatedAt: '2026-07-29T09:02:00Z',
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

    expect(useWorkspaceStore.getState().activities.find(
      ({ sourceId }) => sourceId === 'intelligence',
    )?.phase).toBe('discarded');
    expect(screen.queryByText('Late result')).not.toBeInTheDocument();
  });

  it('discards an intelligence response with the wrong symbol identity', async () => {
    let callbacks: {
      onSuccess?: (result: SymbolIntelligence) => void;
      onSettled?: (result: SymbolIntelligence, error: null) => Promise<void>;
    } = {};
    vi.mocked(intelligenceHooks.useIntelligenceAnalysisMutation).mockReturnValue({
      mutate: vi.fn((_input, options) => {
        callbacks = options as typeof callbacks;
      }),
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
    useWorkspaceStore.setState({ analysisTab: 'intelligence' });
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.intelligence.generate'),
    }));
    const wrongSymbol: SymbolIntelligence = {
      symbol: 'MSFT',
      generatedAt: '2026-07-29T09:02:00Z',
      action: 'WATCH',
      conviction: 'low',
      catalystUrgency: 'low',
      summaryLine: 'Wrong symbol result',
      narrative: 'Wrong symbol result',
      upcomingEvents: [],
      positionSignal: null,
      sources: [],
      evidenceLedger: null,
      classifiedCatalysts: [],
    };
    await act(async () => {
      callbacks.onSuccess?.(wrongSymbol);
      await callbacks.onSettled?.(wrongSymbol, null);
    });

    expect(useWorkspaceStore.getState().activities.find(
      ({ sourceId }) => sourceId === 'intelligence',
    )?.phase).toBe('discarded');
    expect(screen.queryByText('Wrong symbol result')).not.toBeInTheDocument();
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
    const { user, unmount } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.intelligence.generate'),
    }));
    unmount();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
    expect(useWorkspaceStore.getState().activities.find(
      ({ sourceId }) => sourceId === 'intelligence',
    )?.phase).toBe('discarded');
    consoleError.mockRestore();
  });

  it('keeps a partial evidence refresh retryable', async () => {
    let callbacks: {
      onSuccess?: (result: EvidenceRefreshResponse) => void;
      onSettled?: (result: EvidenceRefreshResponse, error: null) => void;
    } = {};
    vi.mocked(intelligenceHooks.useEvidenceRefreshMutation).mockReturnValue({
      mutate: vi.fn((_ticker, options) => {
        callbacks = options as typeof callbacks;
      }),
      isPending: false,
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
    useWorkspaceStore.setState({ analysisTab: 'intelligence' });
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.intelligence.refreshEvidence'),
    }));
    const response: EvidenceRefreshResponse = {
      ticker: 'AAPL',
      refreshedAt: '2026-07-29T09:02:00Z',
      status: 'partial',
      sources: [{
        source: 'evidence',
        provider: 'finnhub',
        status: 'failed',
        itemCount: 0,
        asOf: '2026-07-29',
        message: 'Provider unavailable',
      }],
    };
    act(() => {
      callbacks.onSuccess?.(response);
      callbacks.onSettled?.(response, null);
    });

    expect(useWorkspaceStore.getState().activities.find(
      ({ sourceId }) => sourceId === 'evidence',
    )).toMatchObject({
      phase: 'partial',
      retryable: true,
      message: 'Provider unavailable',
    });
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
    const candidate = useScreenerStore.getState().lastResult?.candidates[0];
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: 'AAPL', source: 'last_run', runId: 'last-fixture', rowId: 'last-fixture:AAPL', candidate,
    });
    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getAllByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'))).toHaveLength(1);
    expect(screen.getByRole('table', { name: t('workspacePage.overview.tradePlan') })).toBeVisible();
  });

  it('keeps a pinned candidate through tab switches after Last Run diverges', async () => {
    const pinnedCandidate = {
      ticker: 'AAPL', name: 'Pinned run', currency: 'USD', close: 180,
      sma20: 175, sma50: 170, sma200: 160, atr: 3, momentum6m: 0.18,
      momentum12m: 0.27, relStrength: 0.09, score: 0.82, confidence: 79, rank: 1,
    } as any;
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: 'AAPL', source: 'today_run', runId: 'pinned-run',
      rowId: 'today:pinned-run:AAPL', candidate: pinnedCandidate,
    });
    useScreenerStore.setState({
      lastResult: { candidates: [{ ...pinnedCandidate, name: 'New Last Run' }] } as never,
    });
    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByRole('heading', { name: /Pinned run/ })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.fundamentals') }));
    await user.click(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.overview') }));
    expect(screen.getByRole('heading', { name: /Pinned run/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /New Last Run/ })).not.toBeInTheDocument();
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

    selectStoredCandidate();
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

    selectStoredCandidate();
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

    selectStoredCandidate();
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

  it('auto-computes a live candidate again when the same ticker gets a new selection session', async () => {
    // VALE is an open position in the default MSW handler, with no cached candidate.
    const mutate = vi.fn();
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({
      mutate, isPending: false, isError: false, error: null,
    } as never);
    vi.mocked(portfolioHooks.useOpenPositions).mockReturnValue({
      data: [{
        positionId: 'VALE-1', ticker: 'VALE', entryPrice: 10, stopPrice: 9, targetPrice: 12,
        shares: 1, perShareRisk: 1, rNow: 0, daysOpen: 1, pnl: 0, pnlPercent: 0,
        entryValue: 10, currentValue: 10, totalRisk: 1, feesEur: 0, rFxAdjusted: null,
        timeStopWarning: false, trailMethod: 'sma20', trailParam: null,
      }],
    } as never);
    useWorkspaceStore.setState({
      selectedTicker: 'VALE',
      selectedTickerSource: 'screener',
      selection: { ticker: 'VALE', source: 'today_position', rowId: 'position:VALE' },
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
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: 'VALE', source: 'portfolio', rowId: 'portfolio:VALE',
    });
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2);
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

    expect(screen.getByRole('button', {
      name: t('workspacePage.fundamentals.refresh'),
    })).toBeInTheDocument();
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
    vi.mocked(portfolioHooks.useOpenPositions).mockReturnValue({ data: [] } as never);
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
    vi.mocked(intelligenceHooks.useEvidenceRefreshMutation).mockReturnValue({
      mutate: vi.fn(), isPending: false, error: null, reset: vi.fn(),
    } as never);
    vi.mocked(intelligenceHooks.useRunTrace).mockReturnValue({
      data: undefined, isLoading: false, isError: false,
    } as never);
    vi.mocked(intelligenceHooks.useTickerRuns).mockReturnValue({
      data: [], refetch: vi.fn().mockResolvedValue({ data: [] }),
    } as never);
    vi.mocked(catalystHooks.useSymbolCatalystQuery).mockReturnValue({
      data: undefined, isLoading: false, isError: false,
    } as never);
    mockFundamentalsIdle();
    useWorkspaceStore.setState({ selectedTicker: 'ENI.MI', selectedTickerSource: null, selection: null, analysisTab: 'overview' });
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
    const candidate = useScreenerStore.getState().lastResult?.candidates[0];
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: 'AAPL', source: 'last_run', runId: 'last-fixture', rowId: 'last-fixture:AAPL', candidate,
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

  it('keeps Last Run unchanged when an ad-hoc compute response reaches the canvas', async () => {
    let onSuccess: ((result: unknown, request: unknown) => void) | undefined;
    const mutate = vi.fn();
    vi.mocked(screenerHooks.useRunScreenerMutation).mockImplementation((success) => {
      onSuccess = success as (result: unknown, request: unknown) => void;
      return { mutate, isPending: false, isError: false, error: null } as never;
    });
    const lastRun = { candidates: [{ ticker: 'AAPL' }] } as never;
    useScreenerStore.setState({ lastResult: lastRun });
    useWorkspaceStore.getState().setSelectedTicker('ENI.MI');

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);
    await user.click(screen.getByRole('button', { name: 'Compute analysis' }));
    act(() => {
      onSuccess?.(
        { candidates: [{ ticker: 'ENI.MI', currency: 'EUR' }] },
        { tickers: ['ENI.MI'], top: 1, includeHeld: true },
      );
    });

    expect(useWorkspaceStore.getState().selection?.source).toBe('ad_hoc');
    expect(useScreenerStore.getState().lastResult).toBe(lastRun);
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
