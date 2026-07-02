import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import ActionInbox from './ActionInbox';
import type {
  DailyReview,
  DailyReviewPositionClose,
  DailyReviewPositionUpdate,
  DailyReviewCandidate,
  PendingOrderReview,
} from '@/features/dailyReview/types';
import type { WatchItem } from '@/features/watchlist/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<DailyReview['summary']> = {}): DailyReview['summary'] {
  return {
    totalPositions: 0,
    noAction: 0,
    updateStop: 0,
    closePositions: 0,
    exitSignal: 0,
    newCandidates: 0,
    addOnCandidates: 0,
    watchlistNearTrigger: 0,
    reviewDate: '2026-06-26',
    ...overrides,
  };
}

function makeEmptyReview(overrides: Partial<DailyReview> = {}): DailyReview {
  return {
    watchlistNearTrigger: [],
    newCandidates: [],
    positionsAddOnCandidates: [],
    positionsHold: [],
    positionsUpdateStop: [],
    positionsClose: [],
    positionsExitSignal: [],
    pendingOrdersReview: [],
    summary: makeSummary(),
    ...overrides,
  };
}

function makeClose(overrides: Partial<DailyReviewPositionClose> = {}): DailyReviewPositionClose {
  return {
    positionId: 'pos-close-1',
    ticker: 'AAPL',
    entryPrice: 100,
    stopPrice: 95,
    currentPrice: 90,
    rNow: -1,
    daysOpen: 3,
    timeStopWarning: false,
    reason: 'AAPL closed below stop.',
    ...overrides,
  };
}

function makeUpdate(overrides: Partial<DailyReviewPositionUpdate> = {}): DailyReviewPositionUpdate {
  return {
    positionId: 'pos-update-1',
    ticker: 'MSFT',
    entryPrice: 400,
    stopCurrent: 380,
    stopSuggested: 395,
    currentPrice: 420,
    rNow: 1.5,
    daysOpen: 10,
    timeStopWarning: false,
    reason: 'Trail stop up.',
    exhaustionScore: 6.5,
    exhaustionLabel: 'watch',
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<DailyReviewCandidate> = {}): DailyReviewCandidate {
  return {
    ticker: 'AMD',
    signal: 'breakout',
    close: 150,
    entry: 151,
    stop: 145,
    shares: 10,
    rReward: 2.1,
    name: 'AMD Inc',
    sector: 'Tech',
    ...overrides,
  };
}

function makePendingOrder(overrides: Partial<PendingOrderReview> = {}): PendingOrderReview {
  return {
    orderId: 'ord-1',
    ticker: 'TSLA',
    category: 'stale',
    daysPending: 5,
    ...overrides,
  };
}

function makeWatchItem(overrides: Partial<WatchItem> = {}): WatchItem {
  return {
    ticker: 'ASML',
    watchedAt: '2026-05-01T10:00:00Z',
    source: 'screener',
    priceHistory: [],
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────

let mockDailyReview: {
  data: DailyReview | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
  isFetching: boolean;
  dataUpdatedAt: number;
};
let mockWeeklyReviews: { data: Array<{ week_id: string }> | undefined };
let cancelOrderMutate: ReturnType<typeof vi.fn>;

vi.mock('@/features/dailyReview/api', () => ({
  useDailyReview: () => mockDailyReview,
}));

vi.mock('@/features/weeklyReview/hooks', () => ({
  useWeeklyReviews: () => mockWeeklyReviews,
}));

vi.mock('@/features/portfolio/hooks', async (orig) => {
  const actual = await orig<typeof import('@/features/portfolio/hooks')>();
  return {
    ...actual,
    usePositions: () => ({ data: [] }),
    useOpenPositionsIntelligence: () => ({ data: [] }),
    useCancelOrderMutation: () => ({ mutate: cancelOrderMutate, isPending: false }),
  };
});

beforeEach(() => {
  mockDailyReview = {
    data: makeEmptyReview(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
    dataUpdatedAt: Date.parse('2026-06-26T10:00:00Z'),
  };
  mockWeeklyReviews = { data: [] };
  cancelOrderMutate = vi.fn();
});

function getRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-testid="inbox-row"]')) as HTMLElement[];
}

// ─── Keyboard navigation (KEEP, ported from Today.test.tsx) ────────────────

describe('ActionInbox — keyboard navigation syncs with click', () => {
  it('pressing j after clicking the second item advances to the third, not from keyboard position 0', () => {
    mockDailyReview.data = makeEmptyReview({
      positionsClose: [
        makeClose({ ticker: 'AMAT', positionId: 'pos-amat' }),
        makeClose({ ticker: 'NVDA', positionId: 'pos-nvda' }),
        makeClose({ ticker: 'MSFT', positionId: 'pos-msft' }),
      ],
    });

    const { container } = renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    const nvdaTicker = screen.getByText('NVDA');
    fireEvent.click(nvdaTicker);

    // Pressing j should advance from NVDA (index 1) → MSFT (index 2), not from -1 → 0 (AMAT).
    fireEvent.keyDown(window, { key: 'j' });

    const rows = getRows(container);
    expect(rows[2]).toHaveClass('ring-1');
  });
});

// ─── Refresh accessibility (KEEP) ───────────────────────────────────────────

describe('ActionInbox — accessibility', () => {
  it('refresh button has an explicit aria-label, not just a title attribute', () => {
    renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);
    const refreshButton = screen.getByRole('button', { name: t('todayPage.inbox.refresh') });
    expect(refreshButton).toHaveAttribute('aria-label', t('todayPage.inbox.refresh'));
  });
});

// ─── Header ──────────────────────────────────────────────────────────────

describe('ActionInbox — header', () => {
  it('shows an item-count badge and an as-of stamp derived from the review date', () => {
    mockDailyReview.data = makeEmptyReview({ positionsClose: [makeClose()] });
    renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    // Time formatting is locale/timezone-dependent; assert only the stable date portion.
    expect(screen.getByText(/2026-06-26/)).toBeInTheDocument();
  });
});

// ─── Stale vs still_valid pending orders (transformed) ──────────────────────

describe('ActionInbox — pending order rows', () => {
  it('renders a staleOrder row for a stale order and omits still_valid orders entirely', () => {
    mockDailyReview.data = makeEmptyReview({
      pendingOrdersReview: [
        makePendingOrder({ orderId: 'ORD-TSLA-001', ticker: 'TSLA', category: 'stale', daysPending: 8 }),
        makePendingOrder({ orderId: 'ORD-AMD-001', ticker: 'AMD', category: 'still_valid', daysPending: 2 }),
      ],
    });

    renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.inbox.kinds.staleOrder'))).toBeInTheDocument();
    expect(screen.queryByText('AMD')).not.toBeInTheDocument();
  });
});

// ─── Priority ordering (transformed from the section-ordering specs) ───────

describe('ActionInbox — priority ordering', () => {
  it('orders rows close < updateStop < staleOrder < newCandidate < watch by DOM position', () => {
    mockDailyReview.data = makeEmptyReview({
      positionsClose: [makeClose({ ticker: 'CLOSEME', positionId: 'pos-closeme' })],
      positionsUpdateStop: [makeUpdate({ ticker: 'UPDATEME', positionId: 'pos-updateme' })],
      pendingOrdersReview: [makePendingOrder({ orderId: 'ord-stale', ticker: 'STALEME', category: 'stale' })],
      newCandidates: [makeCandidate({ ticker: 'CANDIDATEME' })],
      watchlistNearTrigger: [makeWatchItem({ ticker: 'WATCHME' })],
    });

    const { container } = renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    const rows = getRows(container);
    const indexOf = (ticker: string) => rows.findIndex((row) => row.textContent?.includes(ticker));

    const closeIdx = indexOf('CLOSEME');
    const updateStopIdx = indexOf('UPDATEME');
    const staleOrderIdx = indexOf('STALEME');
    const newCandidateIdx = indexOf('CANDIDATEME');
    const watchIdx = indexOf('WATCHME');

    expect([closeIdx, updateStopIdx, staleOrderIdx, newCandidateIdx, watchIdx]).not.toContain(-1);
    expect(closeIdx).toBeLessThan(updateStopIdx);
    expect(updateStopIdx).toBeLessThan(staleOrderIdx);
    expect(staleOrderIdx).toBeLessThan(newCandidateIdx);
    expect(newCandidateIdx).toBeLessThan(watchIdx);
  });
});

// ─── Weekly review nudge (transformed from pending-badge + weekly-nudge) ───

describe('ActionInbox — weekly review row', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a weeklyReview row when it is Friday and there is no review for the current week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-26T12:00:00')); // Friday, no review recorded
    mockWeeklyReviews = { data: [] };

    renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    expect(screen.getByText(t('todayPage.inbox.kinds.weeklyReview'))).toBeInTheDocument();
  });

  it('omits the weeklyReview row when the current week already has a review', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-26T12:00:00')); // Friday, week 2026-W25
    mockWeeklyReviews = { data: [{ week_id: '2026-W25' }] };

    renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    expect(screen.queryByText(t('todayPage.inbox.kinds.weeklyReview'))).not.toBeInTheDocument();
  });
});

// ─── Zero state (NEW) ───────────────────────────────────────────────────────

describe('ActionInbox — zero state', () => {
  it('shows the zero state when there are no items and loading has finished', () => {
    mockDailyReview.data = makeEmptyReview();
    renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    expect(screen.getByText(t('todayPage.inbox.zeroTitle'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.inbox.zeroSubtitle'))).toBeInTheDocument();
  });

  it('does not show the zero state while items are present', () => {
    mockDailyReview.data = makeEmptyReview({ positionsClose: [makeClose()] });
    renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    expect(screen.queryByText(t('todayPage.inbox.zeroTitle'))).not.toBeInTheDocument();
  });
});

// ─── Cold-load skeleton ─────────────────────────────────────────────────────

describe('ActionInbox — cold load', () => {
  it('renders 4 skeleton rows and no items when loading with no cached data', () => {
    mockDailyReview = {
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
      dataUpdatedAt: 0,
    };

    const { container } = renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);

    expect(container.querySelectorAll('[data-testid="inbox-skeleton-row"]')).toHaveLength(4);
    expect(screen.queryByText(t('todayPage.inbox.zeroTitle'))).not.toBeInTheDocument();
  });
});

// ─── Cancel-order flow (NEW) ────────────────────────────────────────────────

describe('ActionInbox — cancel order flow', () => {
  it('confirms then calls the cancel-order mutation with the order id', async () => {
    mockDailyReview.data = makeEmptyReview({
      pendingOrdersReview: [makePendingOrder({ orderId: 'ORD-TSLA-001', ticker: 'TSLA', category: 'stale' })],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { user } = renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);
    await user.click(screen.getByText(t('todayPage.inbox.actions.cancelOrder')));

    expect(confirmSpy).toHaveBeenCalledWith(t('todayPage.inbox.cancelOrderConfirm'));
    expect(cancelOrderMutate).toHaveBeenCalledWith('ORD-TSLA-001');

    confirmSpy.mockRestore();
  });

  it('does not call the cancel-order mutation when the confirm dialog is declined', async () => {
    mockDailyReview.data = makeEmptyReview({
      pendingOrdersReview: [makePendingOrder({ orderId: 'ORD-TSLA-001', ticker: 'TSLA', category: 'stale' })],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { user } = renderWithProviders(<ActionInbox onTickerSelect={vi.fn()} />);
    await user.click(screen.getByText(t('todayPage.inbox.actions.cancelOrder')));

    expect(confirmSpy).toHaveBeenCalled();
    expect(cancelOrderMutate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
