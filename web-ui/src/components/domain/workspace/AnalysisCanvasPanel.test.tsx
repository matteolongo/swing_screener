import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import * as fundamentalsHooks from '@/features/fundamentals/hooks';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/features/fundamentals/hooks', () => ({
  useFundamentalSnapshotQuery: vi.fn(),
  useRefreshFundamentalSnapshotMutation: vi.fn(),
}));

vi.mock('@/components/domain/market/CachedSymbolPriceChart', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Chart {ticker}</div>,
}));

vi.mock('@/components/domain/workspace/KeyMetrics', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Key metrics {ticker}</div>,
}));

vi.mock('@/components/domain/workspace/SymbolNoteWidget', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Note {ticker}</div>,
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

    expect(screen.getByText('No fundamentals snapshot available yet.')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Run fundamentals analysis' }));
    });

    expect(mutate).toHaveBeenCalledWith('AAPL');
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
    expect(screen.getByText(/Buy Now/)).toBeInTheDocument();
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
      screen.getByText(/Metric labels show whether a number is price-derived/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('price-derived').length).toBeGreaterThan(0);
    expect(screen.getAllByText('snapshot').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/price-derived · snapshot · yfinance · 2026-03-19/i).length
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
});
