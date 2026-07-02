import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SymbolDrawer from '@/components/domain/symbol/SymbolDrawer';
import * as fundamentalsHooks from '@/features/fundamentals/hooks';
import * as catalystHooks from '@/features/intelligence/catalysts/hooks';
import * as intelligenceHooks from '@/features/intelligence/hooks';
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
  useIntelligenceHistoryQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/features/intelligence/catalysts/hooks', () => ({
  useSymbolCatalystQuery: vi.fn(),
}));

vi.mock('@/features/screener/hooks', () => ({
  useRunScreenerMutation: vi.fn(),
}));

vi.mock('@/features/watchlist/hooks', () => ({
  useWatchlist: vi.fn(),
  useWatchSymbolMutation: vi.fn(),
  useUnwatchSymbolMutation: vi.fn(),
}));

vi.mock('@/components/domain/market/CachedSymbolCandleChart', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Chart {ticker}</div>,
}));

describe('SymbolDrawer', () => {
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

    useWorkspaceStore.setState({
      selectedTicker: null,
      selectedTickerSource: null,
      analysisTab: 'overview',
    });
    useScreenerStore.setState({ lastResult: null });
  });

  it('renders nothing when no ticker is selected', () => {
    renderWithProviders(<SymbolDrawer />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with the ticker in the title and the symbol analysis content when selected', () => {
    useWorkspaceStore.getState().setSelectedTicker('AAPL');
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

    renderWithProviders(<SymbolDrawer />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    const header = dialog.querySelector('header');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.overview') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.fundamentals') })).toBeInTheDocument();
    expect(screen.getByText(/AAPL Decision Summary/)).toBeInTheDocument();
  });

  it('clears the selected ticker and closes on Escape', () => {
    useWorkspaceStore.getState().setSelectedTicker('AAPL');

    renderWithProviders(<SymbolDrawer />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(useWorkspaceStore.getState().selectedTicker).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a permalink to the full symbol page that clears the selection on click', async () => {
    useWorkspaceStore.getState().setSelectedTicker('AAPL');

    const { user } = renderWithProviders(<SymbolDrawer />);

    const dialog = screen.getByRole('dialog');
    const header = dialog.querySelector('header') as HTMLElement;
    const link = within(header).getByRole('link', { name: t('symbolDrawer.openFull') });
    expect(link).toHaveAttribute('href', '/symbol/AAPL');

    await act(async () => {
      await user.click(link);
    });

    expect(useWorkspaceStore.getState().selectedTicker).toBeNull();
  });

  it('clears the selected ticker and closes on close button click', async () => {
    useWorkspaceStore.getState().setSelectedTicker('AAPL');

    const { user } = renderWithProviders(<SymbolDrawer />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: t('common.close') }));
    });

    expect(useWorkspaceStore.getState().selectedTicker).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
