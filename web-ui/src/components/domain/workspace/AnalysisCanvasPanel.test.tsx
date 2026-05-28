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

vi.mock('@/features/fundamentals/hooks', () => ({
  useFundamentalSnapshotQuery: vi.fn(),
  useRefreshFundamentalSnapshotMutation: vi.fn(),
}));

vi.mock('@/features/intelligence/hooks', () => ({
  useIntelligenceAnalysisMutation: vi.fn(),
  useIntelligenceLatestQuery: vi.fn(),
}));

vi.mock('@/features/intelligence/catalysts/hooks', () => ({
  useSymbolCatalystQuery: vi.fn(),
}));

vi.mock('@/features/screener/hooks', () => ({
  useUniverses: vi.fn(),
  useRunScreenerMutation: vi.fn(),
}));

vi.mock('@/features/watchlist/hooks', () => ({
  useWatchlist: vi.fn(),
  useWatchSymbolMutation: vi.fn(),
  useUnwatchSymbolMutation: vi.fn(),
}));

vi.mock('@/components/domain/market/CachedSymbolPriceChart', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Chart {ticker}</div>,
}));

vi.mock('@/components/domain/workspace/KeyMetrics', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Key metrics {ticker}</div>,
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
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
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

  it('runs fundamentals analysis for the selected symbol from the canvas', async () => {
    const mutate = vi.fn();

    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate,
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByText(t('workspacePage.panels.analysis.fundamentals.noSnapshot'))).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Run fundamentals analysis' }));
    });

    expect(mutate).toHaveBeenCalledWith('AAPL');
  });

  it('renders NarrativeAnalysisCard in overview when intelligence latest has a narrative', () => {
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

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.queryByRole('tab', { name: 'Intelligence' })).toBeNull();
    // NarrativeAnalysisCard shows the summaryLine
    expect(screen.getByText('AAPL is showing strong momentum with a confirmed breakout.')).toBeInTheDocument();
    // DecisionSummaryCard heading should NOT appear
    expect(screen.queryByText(/AAPL Decision Summary/)).not.toBeInTheDocument();
  });

  it('renders the decision summary card in overview for the selected screener candidate', () => {
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
              catalystSummary: null,
              catalystSources: [],
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

    expect(screen.getByText(/AAPL Decision Summary/)).toBeInTheDocument();
    expect(screen.getAllByText(/Buy Now/).length).toBeGreaterThan(0);
  });

  it('renders the price chart before the catalyst card in overview', () => {
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
              catalystSummary: null,
              catalystSources: [],
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
      chart.compareDocumentPosition(catalyst) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('can run AI analysis from the overview tab', async () => {
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
    };
    const mutate = vi.fn((_variables: unknown, options?: { onSuccess?: (result: SymbolIntelligence) => void }) => {
      options?.onSuccess?.(mockIntelligence);
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
              catalystSummary: null,
              catalystSources: [],
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

    expect(screen.getByText('AI narrative summary')).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Analyze with AI' }));
    });

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL' }),
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(screen.getByText('AAPL is showing strong momentum with a confirmed breakout.')).toBeInTheDocument();
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

    expect(screen.getByText('About metric labels')).toBeInTheDocument();
    expect(screen.getByText('Live price')).toBeInTheDocument();
    expect(screen.getByText('Reported')).toBeInTheDocument();
    expect(screen.getByText('Latest FY / quarter')).toBeInTheDocument();
    expect(
      screen.getAllByText(/yfinance · 2026-03-19/i).length
    ).toBeGreaterThan(0);
  });

  it('live reloads the selected candidate when refreshed fundamentals arrive', async () => {
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

    await waitFor(() => {
      const candidate = useScreenerStore.getState().lastResult?.candidates[0];
      expect(candidate?.fundamentalsCoverageStatus).toBe('supported');
      expect(candidate?.decisionSummary?.valuationContext.method).toBe('earnings_multiple');
      expect(candidate?.decisionSummary?.valuationContext.summary).toContain('Trailing PE is 24.6x');
    });
  });

  it('shows DecisionSummaryCard in overview while intelligence is loading', () => {
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
              catalystSummary: null,
              catalystSources: [],
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

    expect(screen.getByText(/AAPL Decision Summary/)).toBeInTheDocument();
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
              catalystSummary: null,
              catalystSources: [],
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

  it('renders a watch toggle for the selected symbol', () => {
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

  it('fundamentals tab: metric labels glossary is collapsed by default', () => {
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
      screen.getByText('multiple or ratio that moves with the stock price')
    ).not.toBeVisible();
  });

  it('fundamentals tab: metric labels glossary details has no open attribute', () => {
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

    const details = screen.getByText('About metric labels').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
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

    expect(mutate).toHaveBeenCalledWith({ tickers: ['ENI.MI'], top: 1 });
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
