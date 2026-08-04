import { beforeEach, describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import TodayActionList from './TodayActionList';
import { useScreenerStore, type TodayRunSnapshot } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const { positionsClose } = vi.hoisted(() => ({
  positionsClose: { current: [] as Array<Record<string, unknown>> },
}));

// Minimal daily-review payload: one open position that is NO_ACTION (hold).
vi.mock('@/features/dailyReview/api', () => ({
  usePortfolioReview: () => ({
    data: {
      summary: { reviewDate: '2026-06-26', newCandidates: 0, updateStop: 0, closePositions: 0 },
      watchlistNearTrigger: [],
      positionsClose: positionsClose.current,
      positionsUpdateStop: [],
      positionsExitSignal: [],
      pendingOrdersReview: [],
      newCandidates: [{ ticker: 'UNPINNED' }],
      positionsAddOnCandidates: [],
      positionsHold: [{ ticker: 'LRCX', positionId: 'POS-1', trimSuggestion: null }],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

vi.mock('@/features/portfolio/hooks', async (orig) => {
  const actual = await orig<typeof import('@/features/portfolio/hooks')>();
  return {
    ...actual,
    usePositions: () => ({
      data: [{ positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3, shares: 1, rNow: 0.51, daysOpen: 10 }],
    }),
    useOpenPositionsIntelligence: () => ({ data: [] }),
  };
});

describe('TodayActionList holdings', () => {
  beforeEach(() => {
    positionsClose.current = [];
    useScreenerStore.setState({
      lastResult: null,
      lastRunContext: null,
      todayRun: null,
      todayRunInitialized: true,
    });
  });

  it('shows held positions under Open Positions and renders no separate Holding section', () => {
    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    expect(screen.getByText(new RegExp(t('todayPage.actionList.openPositions')))).toBeInTheDocument();
    expect(screen.queryByText(t('todayPage.actionList.holding'))).not.toBeInTheDocument();
    expect(screen.getAllByText('LRCX')).toHaveLength(1);
  });

  it('renders only the symbol rail variant when compact', () => {
    useWorkspaceStore.setState({ selectedTicker: 'LRCX' });
    renderWithProviders(<TodayActionList compact onTickerSelect={() => {}} />);

    expect(screen.getByTestId('symbol-rail-list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LRCX/i })).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('button', {
      name: t('dailyReview.header.refreshTitle'),
    })).not.toBeInTheDocument();
  });

  it('prioritizes an urgent close over the generic held-position row', () => {
    positionsClose.current = [{
      ticker: 'LRCX',
      positionId: 'POS-1',
      reason: 'Stop breached',
    }];
    renderWithProviders(<TodayActionList compact onTickerSelect={() => {}} />);

    const rail = screen.getByTestId('symbol-rail-list');
    expect(within(rail).getByText(t('todayPage.actionList.close'))).toBeInTheDocument();
    expect(within(rail).getByText('Stop breached')).toBeInTheDocument();
    expect(within(rail).queryByText(t('todayPage.actionList.openPositions')))
      .not.toBeInTheDocument();
  });

  it('renders opportunities from the pinned run, not candidate rows returned by portfolio refresh', () => {
    useScreenerStore.setState({
      todayRun: {
        request: { preset: 'us_large_cap_equities' },
        displayFilters: { recommendedOnly: true, actionFilter: 'all' },
        completedAt: '2026-07-10T20:00:00Z',
        result: {
          asofDate: '2026-07-10',
          candidates: [{
            ticker: 'PINNED',
            currency: 'USD',
            close: 100,
            sma20: null,
            sma50: null,
            sma200: null,
            atr: 1,
            momentum6m: 0,
            momentum12m: 0,
            relStrength: 0,
            score: 1,
            confidence: 90,
            rank: 1,
            rr: 2,
            recommendation: {
              verdict: 'RECOMMENDED',
              workflowStatus: 'ready',
              nextStep: { code: 'review_order' },
            },
          }],
          totalScreened: 1,
          dataFreshness: 'final_close',
        },
      } as unknown as TodayRunSnapshot,
    });

    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    expect(screen.getByText('PINNED')).toBeInTheDocument();
    expect(screen.queryByText('UNPINNED')).not.toBeInTheDocument();
    expect(screen.getByText(/Opportunities from us_large_cap_equities/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: t('todayPage.actionList.readyFilter'),
    })).toBeInTheDocument();
  });
});
