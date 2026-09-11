import { beforeEach, describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import TodayActionList from './TodayActionList';
import { useScreenerStore, type TodayRunSnapshot } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const { reviewQuery, positionsQuery, watchlistQuery } = vi.hoisted(() => ({
  reviewQuery: {
    current: null as any,
  },
  positionsQuery: {
    current: null as any,
  },
  watchlistQuery: {
    current: null as any,
  },
}));

// Minimal daily-review payload: one open position that is NO_ACTION (hold).
vi.mock('@/features/dailyReview/api', () => ({
  usePortfolioReview: () => reviewQuery.current,
  useWatchlistNearTrigger: () => watchlistQuery.current,
}));

vi.mock('@/features/portfolio/hooks', async (orig) => {
  const actual = await orig<typeof import('@/features/portfolio/hooks')>();
  return {
    ...actual,
    usePositions: () => positionsQuery.current,
    useOpenPositionsIntelligence: () => ({ data: [] }),
    useEarningsProximity: () => ({ data: { warning: false } }),
  };
});

describe('TodayActionList holdings', () => {
  beforeEach(() => {
    reviewQuery.current = {
      data: {
        summary: { reviewDate: '2026-06-26', newCandidates: 0, updateStop: 0, closePositions: 0 },
        watchlistNearTrigger: [],
        positionsClose: [],
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
    };
    positionsQuery.current = {
      data: [{ positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3, shares: 2, rNow: 0.51, daysOpen: 10 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    };
    watchlistQuery.current = {
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    };
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
    reviewQuery.current.data.positionsClose = [{
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

  it('keeps loaded positions, pinned candidates, and watchlist visible when review refresh fails', () => {
    reviewQuery.current = {
      ...reviewQuery.current,
      data: undefined,
      error: new Error('review unavailable'),
    };
    useScreenerStore.setState({
      todayRun: {
        request: { preset: 'us_large_cap_equities' },
        displayFilters: { recommendedOnly: true, actionFilter: 'all' },
        completedAt: '2026-07-10T20:00:00Z',
        result: {
          asofDate: '2026-07-10',
          candidates: [{
            ticker: 'PINNED', currency: 'USD', close: 100, sma20: null, sma50: null, sma200: null,
            atr: 1, momentum6m: 0, momentum12m: 0, relStrength: 0, score: 1, confidence: 90, rank: 1, rr: 2,
            recommendation: { verdict: 'RECOMMENDED', workflowStatus: 'ready', nextStep: { code: 'review_order' } },
          }],
          totalScreened: 1, dataFreshness: 'final_close',
        },
      } as unknown as TodayRunSnapshot,
    });
    watchlistQuery.current.data = [{
      ticker: 'WATCHED', watchedAt: '2026-07-10', source: 'manual', priceHistory: [],
    }];

    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    expect(screen.getByText('LRCX')).toBeInTheDocument();
    expect(screen.getByText('PINNED')).toBeInTheDocument();
    expect(screen.getByText('WATCHED')).toBeInTheDocument();
    expect(screen.getByText(/review unavailable/i)).toBeInTheDocument();
  });

  it('keeps watchlist rows that have no composed candidate row', () => {
    watchlistQuery.current.data = [{ ticker: 'MANAGED', watchedAt: '2026-07-10', source: 'manual', priceHistory: [] }];
    useScreenerStore.setState({
      todayRun: {
        request: { preset: 'us_large_cap_equities' },
        displayFilters: { recommendedOnly: true, actionFilter: 'all' },
        completedAt: '2026-07-10T20:00:00Z',
        result: {
          asofDate: '2026-07-10',
          candidates: [
            {
              ticker: 'PINNED', currency: 'USD', close: 100, sma20: null, sma50: null, sma200: null,
              atr: 1, momentum6m: 0, momentum12m: 0, relStrength: 0, score: 1, confidence: 90, rank: 1, rr: 2,
              recommendation: { verdict: 'RECOMMENDED', workflowStatus: 'ready', nextStep: { code: 'review_order' } },
            },
            {
              ticker: 'MANAGED', currency: 'USD', close: 100, sma20: null, sma50: null, sma200: null,
              atr: 1, momentum6m: 0, momentum12m: 0, relStrength: 0, score: 1, confidence: 90, rank: 2, rr: 2,
              recommendation: { verdict: 'RECOMMENDED', workflowStatus: 'ready', nextStep: { code: 'review_order' } },
              sameSymbol: { mode: 'MANAGE_ONLY' },
            },
          ],
          totalScreened: 2, dataFreshness: 'final_close',
        },
      } as unknown as TodayRunSnapshot,
    });

    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    expect(screen.getByText('MANAGED')).toBeInTheDocument();
  });

  it('opens trim from the canonical open-position row when review metadata recommends it', async () => {
    reviewQuery.current.data.positionsHold = [{
      ticker: 'LRCX', positionId: 'POS-1', trimSuggestion: { rThreshold: 2, rNow: 2.1 },
    }];
    const { user } = renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    await user.click(screen.getByText(t('todayPage.actionList.trimAction')));

    expect(screen.getByText(t('positions.partialCloseModal.title', { ticker: 'LRCX' }))).toBeInTheDocument();
  });

  it('counts visible pending orders even when the stale server summary says there are none', () => {
    reviewQuery.current.data.pendingOrdersReview = [{
      orderId: 'ORD-1', ticker: 'PENDING', category: 'still_valid', daysPending: 1,
    }];

    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    expect(screen.getAllByText(new RegExp(`${t('todayPage.actionList.pendingOrdersSection')} · 1`))).toHaveLength(2);
  });

  it('shows loading state for each source independently', () => {
    useScreenerStore.setState({ todayRunInitialized: false });
    reviewQuery.current.isLoading = true;
    positionsQuery.current.isLoading = true;
    watchlistQuery.current.isLoading = true;

    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    expect(screen.getByText(t('todayPage.actionList.loadingPinnedCandidates'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.actionList.loadingReview'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.actionList.loadingPositions'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.actionList.loadingWatchlist'))).toBeInTheDocument();
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
