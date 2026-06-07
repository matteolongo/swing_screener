import { describe, it, expect } from 'vitest';
import { t } from '@/i18n/t';
import { pickTodayPriority } from './beginnerPriority';
import type { DailyReview, DailyReviewPositionClose, DailyReviewPositionUpdate, PendingOrderReview } from './types';
import type { BeginnerDecision } from '@/features/screener/beginnerDecision';
import type { WatchItem } from '@/features/watchlist/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCloseItem(ticker = 'AAPL'): DailyReviewPositionClose {
  return {
    positionId: `POS-${ticker}-01`,
    ticker,
    entryPrice: 150,
    stopPrice: 140,
    currentPrice: 135,
    rNow: -1.5,
    daysOpen: 5,
    timeStopWarning: false,
    reason: 'Stop hit',
  };
}

function makeUpdateItem(ticker = 'MSFT'): DailyReviewPositionUpdate {
  return {
    positionId: `POS-${ticker}-01`,
    ticker,
    entryPrice: 300,
    stopCurrent: 285,
    stopSuggested: 295,
    currentPrice: 320,
    rNow: 1.3,
    daysOpen: 10,
    timeStopWarning: false,
    reason: 'Trail: R=1.3 >= 1.0',
    exhaustionScore: null,
    exhaustionLabel: null,
  };
}

function makeWatchItem(ticker = 'NVDA'): WatchItem {
  return {
    ticker,
    watchedAt: '2026-05-01T10:00:00Z',
    watchPrice: 800,
    currency: 'USD',
    source: 'screener',
    currentPrice: 810,
    distanceToTriggerPct: -1.2,
    priceHistory: [],
  };
}

function makeEmptyReview(): DailyReview {
  return {
    watchlistNearTrigger: [],
    newCandidates: [],
    positionsAddOnCandidates: [],
    positionsHold: [],
    positionsUpdateStop: [],
    positionsClose: [],
    positionsExitSignal: [],
    summary: {
      totalPositions: 0,
      noAction: 0,
      updateStop: 0,
      closePositions: 0,
      newCandidates: 0,
      addOnCandidates: 0,
      watchlistNearTrigger: 0,
      exitSignal: 0,
      reviewDate: '2026-05-14',
    },
  };
}

function makeBeginnerDecision(overrides: Partial<BeginnerDecision> = {}): BeginnerDecision {
  return {
    ticker: 'GOOG',
    setupQuality: 'pass',
    suggestedAction: 'BUY_NOW',
    orderReadiness: 'ready',
    headline: 'GOOG looks ready to buy.',
    plainReason: 'GOOG looks ready to buy.',
    mainRisk: 'Market could reverse.',
    invalidation: undefined,
    nextStepLabel: 'Prepare order',
    nextStepKind: 'prepare_order',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pickTodayPriority', () => {
  it('returns close_position when positionsClose has items', () => {
    const review: DailyReview = {
      ...makeEmptyReview(),
      positionsClose: [makeCloseItem('AAPL')],
    };
    const result = pickTodayPriority(review, 0, undefined);
    expect(result.kind).toBe('close_position');
    expect(result.ticker).toBe('AAPL');
    expect(result.headline).toBe('AAPL needs to be closed');
    expect(result.actionLabel).toBe('Close position');
    expect(result.closeItem).toBeDefined();
    expect(result.risk).toBeTruthy();
  });

  it('returns update_stop when no close but updateStop has items', () => {
    const review: DailyReview = {
      ...makeEmptyReview(),
      positionsUpdateStop: [makeUpdateItem('MSFT')],
    };
    const result = pickTodayPriority(review, 0, undefined);
    expect(result.kind).toBe('update_stop');
    expect(result.ticker).toBe('MSFT');
    expect(result.headline).toBe('MSFT needs a stop update');
    expect(result.actionLabel).toBe('Update stop');
    expect(result.updateItem).toBeDefined();
    expect(result.risk).toBeTruthy();
  });

  it('returns pending_orders when pendingEntryOrderCount > 0', () => {
    const review = makeEmptyReview();
    const result = pickTodayPriority(review, 3, undefined);
    expect(result.kind).toBe('pending_orders');
    expect(result.headline).toBe('3 pending orders need review');
    expect(result.pendingOrderCount).toBe(3);
    expect(result.actionLabel).toBe('Go to Orders');
  });

  it('uses singular form for exactly 1 pending order', () => {
    const result = pickTodayPriority(makeEmptyReview(), 1, undefined);
    expect(result.kind).toBe('pending_orders');
    expect(result.headline).toBe('1 pending order need review');
  });

  it('returns watchlist_near_trigger priority', () => {
    const review: DailyReview = {
      ...makeEmptyReview(),
      watchlistNearTrigger: [makeWatchItem('NVDA')],
    };
    const result = pickTodayPriority(review, 0, undefined);
    expect(result.kind).toBe('watchlist_near_trigger');
    expect(result.ticker).toBe('NVDA');
    expect(result.headline).toBe('NVDA is near trigger');
    expect(result.watchItem).toBeDefined();
  });

  it('returns best_candidate when decision is actionable', () => {
    const decision = makeBeginnerDecision({ orderReadiness: 'ready' });
    const result = pickTodayPriority(makeEmptyReview(), 0, decision);
    expect(result.kind).toBe('best_candidate');
    expect(result.ticker).toBe('GOOG');
    expect(result.decision).toBe(decision);
    expect(result.headline).toBe(decision.headline);
    expect(result.actionLabel).toBe(decision.nextStepLabel);
  });

  it('returns run_screener when review is undefined', () => {
    const result = pickTodayPriority(undefined, 0, undefined);
    expect(result.kind).toBe('run_screener');
    expect(result.headline).toBe('Run the screener to find opportunities');
  });

  it('returns run_screener when review is null', () => {
    const result = pickTodayPriority(null, 0, undefined);
    expect(result.kind).toBe('run_screener');
  });

  it('returns no_action when review is present but empty', () => {
    const result = pickTodayPriority(makeEmptyReview(), 0, undefined);
    expect(result.kind).toBe('no_action');
    expect(result.headline).toBe('Nothing urgent today');
  });

  it('falls through to no_action when bestDecision has avoid readiness', () => {
    const decision = makeBeginnerDecision({ orderReadiness: 'avoid' });
    const result = pickTodayPriority(makeEmptyReview(), 0, decision);
    expect(result.kind).toBe('no_action');
  });

  it('falls through to no_action when bestDecision has manage_existing readiness', () => {
    const decision = makeBeginnerDecision({ orderReadiness: 'manage_existing' });
    const result = pickTodayPriority(makeEmptyReview(), 0, decision);
    expect(result.kind).toBe('no_action');
  });

  it('close_position beats update_stop (priority order respected)', () => {
    const review: DailyReview = {
      ...makeEmptyReview(),
      positionsClose: [makeCloseItem('AAPL')],
      positionsUpdateStop: [makeUpdateItem('MSFT')],
    };
    const result = pickTodayPriority(review, 5, makeBeginnerDecision());
    expect(result.kind).toBe('close_position');
  });

  it('update_stop beats pending_orders (priority order respected)', () => {
    const review: DailyReview = {
      ...makeEmptyReview(),
      positionsUpdateStop: [makeUpdateItem('MSFT')],
    };
    const result = pickTodayPriority(review, 5, makeBeginnerDecision());
    expect(result.kind).toBe('update_stop');
  });

  it('pending_orders beats watchlist_near_trigger (priority order respected)', () => {
    const review: DailyReview = {
      ...makeEmptyReview(),
      watchlistNearTrigger: [makeWatchItem('NVDA')],
    };
    const result = pickTodayPriority(review, 2, makeBeginnerDecision());
    expect(result.kind).toBe('pending_orders');
  });

  it('watchlist_near_trigger beats best_candidate (priority order respected)', () => {
    const review: DailyReview = {
      ...makeEmptyReview(),
      watchlistNearTrigger: [makeWatchItem('NVDA')],
    };
    const decision = makeBeginnerDecision({ orderReadiness: 'ready' });
    const result = pickTodayPriority(review, 0, decision);
    expect(result.kind).toBe('watchlist_near_trigger');
  });

  // ── Pending orders review stale/valid reason ───────────────────────────────

  it('pending_orders priority with stale orders has stale-specific reason', () => {
    const staleOrder: PendingOrderReview = {
      orderId: 'ORD-AAPL-001',
      ticker: 'AAPL',
      category: 'stale',
      daysPending: 7,
    };
    const review = makeEmptyReview();
    const result = pickTodayPriority(review, 1, undefined, [staleOrder]);
    expect(result.kind).toBe('pending_orders');
    expect(result.reason).toBe(t('todayPage.todayPriorityCard.kinds.pending_orders_stale'));
  });

  it('pending_orders priority with all still_valid orders has normal reason', () => {
    const validOrder: PendingOrderReview = {
      orderId: 'ORD-MSFT-001',
      ticker: 'MSFT',
      category: 'still_valid',
      daysPending: 2,
    };
    const review = makeEmptyReview();
    const result = pickTodayPriority(review, 1, undefined, [validOrder]);
    expect(result.kind).toBe('pending_orders');
    expect(result.reason).not.toContain('stale');
  });
});
