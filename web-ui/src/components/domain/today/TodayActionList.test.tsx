import { beforeEach, describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import TodayActionList from './TodayActionList';
import { useScreenerStore, type TodayRunSnapshot } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const { reviewQuery, positionsQuery } = vi.hoisted(() => ({
  reviewQuery: {
    current: null as any,
  },
  positionsQuery: {
    current: null as any,
  },
}));

// Minimal daily-review payload: one open position that is NO_ACTION (hold).
vi.mock('@/features/dailyReview/api', () => ({
  usePortfolioReview: () => reviewQuery.current,
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
      data: [{ positionId: 'POS-1', ticker: 'LRCX', status: 'open', version: 1, entryDate: '2026-06-16', entryPrice: 383.04, stopPrice: 346.3, shares: 2, rNow: 0.51, daysOpen: 10 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    };
    useWorkspaceStore.getState().clearSelectedTicker();
    useScreenerStore.setState({
      lastResult: null,
      lastRunContext: null,
      todayRun: null,
      todayRunInitialized: true,
    });
  });

  it('says which review sections were not checked', () => {
    reviewQuery.current.data.sectionErrors = [
      { section: 'pending_orders', code: 'section_unavailable', message: 'x' },
      { section: 'manage_config', code: 'section_unavailable', message: 'y' },
    ];
    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    expect(screen.getByText(t('todayPage.actionList.sectionsUnavailable'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.actionList.sectionUnavailable.pending_orders'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.actionList.sectionUnavailable.manage_config'))).toBeInTheDocument();
    expect(screen.queryByText(t('todayPage.actionList.sectionUnavailable.watchlist'))).not.toBeInTheDocument();
  });

  it('does not claim there is nothing to do when a section failed', () => {
    reviewQuery.current.data.positionsHold = [];
    reviewQuery.current.data.sectionErrors = [{ section: 'watchlist', code: 'section_unavailable', message: 'x' }];
    positionsQuery.current.data = [];
    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    expect(screen.queryByText(t('todayPage.actionList.empty'))).not.toBeInTheDocument();
  });

  it('shows held positions under Open Positions and renders no separate Holding section', () => {
    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    expect(screen.getByText(new RegExp(t('todayPage.actionList.openPositions')))).toBeInTheDocument();
    expect(screen.queryByText(t('todayPage.actionList.holding'))).not.toBeInTheDocument();
    expect(screen.getAllByText('LRCX')).toHaveLength(1);
  });

  it('preserves watchlist row identity when the symbol is also in the scan', async () => {
    reviewQuery.current.data.watchlistNearTrigger = [{
      ticker: 'WATCHED', watchedAt: '2026-07-10', source: 'manual', priceHistory: [],
    }];
    const candidate = { ticker: 'WATCHED', currency: 'USD' };
    useScreenerStore.setState({ todayRun: {
      request: {},
      displayFilters: { recommendedOnly: false, actionFilter: 'all' },
      completedAt: 'run-1',
      result: { candidates: [candidate] },
    } as unknown as TodayRunSnapshot });

    const { user } = renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    await user.click(screen.getByRole('button', { name: /WATCHED/ }));

    expect(useWorkspaceStore.getState().selection).toMatchObject({
      ticker: 'WATCHED', source: 'today_watchlist', rowId: 'watch-WATCHED-2026-07-10',
      candidate, runId: 'run-1',
    });
    expect(screen.queryByText('UNPINNED')).not.toBeInTheDocument();
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

  it('shows loading state for each portfolio source independently', () => {
    reviewQuery.current.isLoading = true;
    positionsQuery.current.isLoading = true;

    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    expect(screen.getByText(t('todayPage.actionList.loadingReview'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.actionList.loadingPositions'))).toBeInTheDocument();
  });
});
