import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import * as fundamentalsHooks from '@/features/fundamentals/hooks';
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
              valuationContext: { method: 'fundamental_pillar' },
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
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByText('AAPL Decision Summary')).toBeInTheDocument();
    expect(screen.getByText('Buy Now')).toBeInTheDocument();
  });

});
