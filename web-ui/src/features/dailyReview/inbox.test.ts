import { describe, expect, it } from 'vitest';
import { buildInboxItems, type BuildInboxInput } from '@/features/dailyReview/inbox';
import type {
  DailyReview,
  DailyReviewCandidate,
  DailyReviewPositionClose,
  DailyReviewPositionExitSignal,
  DailyReviewPositionUpdate,
  PendingOrderReview,
} from '@/features/dailyReview/types';
import type { WatchItem } from '@/features/watchlist/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import type { OpenPositionIntelligenceSummary } from '@/features/intelligence/types';

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
    reviewDate: '2026-07-01',
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
    summary: makeSummary(),
    pendingOrdersReview: [],
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

function makeExitSignal(overrides: Partial<DailyReviewPositionExitSignal> = {}): DailyReviewPositionExitSignal {
  return {
    positionId: 'pos-exit-1',
    ticker: 'NVDA',
    entryPrice: 800,
    stopPrice: 760,
    currentPrice: 750,
    rNow: -1.25,
    daysOpen: 8,
    reason: 'NVDA below SMA20.',
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

function makePosition(overrides: Partial<PositionWithMetrics> = {}): PositionWithMetrics {
  return {
    ticker: 'AAPL',
    status: 'open',
    entryDate: '2026-06-01',
    entryPrice: 100,
    stopPrice: 95,
    shares: 10,
    pnl: -100,
    pnlPercent: -10,
    rNow: -1,
    entryValue: 1000,
    currentValue: 900,
    perShareRisk: 5,
    totalRisk: 50,
    feesEur: 1,
    daysOpen: 3,
    timeStopWarning: false,
    priceSource: 'live',
    rUsesInitialRisk: true,
    ...overrides,
  };
}

function makeIntelligenceSummary(
  ticker: string,
  positionId: string,
  action: 'HOLD' | 'TRIM' | 'EXIT',
): OpenPositionIntelligenceSummary {
  return {
    positionId,
    ticker,
    entryPrice: 100,
    stopPrice: 90,
    currentPrice: 110,
    rNow: 1,
    daysOpen: 5,
    stopAction: 'hold',
    stopSuggested: 90,
    stopReason: 'trend intact',
    intelligence: {
      symbol: ticker,
      generatedAt: '2026-07-01T00:00:00Z',
      action: 'BUY_NOW',
      conviction: 'high',
      catalystUrgency: 'none',
      summaryLine: 'summary',
      narrative: 'narrative',
      upcomingEvents: [],
      positionSignal: { action, reason: 'reason' },
      sources: [],
    },
  };
}

function baseInput(overrides: Partial<BuildInboxInput> = {}): BuildInboxInput {
  return {
    review: undefined,
    positionById: new Map(),
    intelligenceByTicker: new Map(),
    weeklyReviewDue: false,
    ...overrides,
  };
}

describe('buildInboxItems', () => {
  it('returns [] for an empty review with weeklyReviewDue false', () => {
    const result = buildInboxItems(baseInput({ review: makeEmptyReview() }));
    expect(result).toEqual([]);
  });

  it('returns [] when review is undefined and weeklyReviewDue is false', () => {
    const result = buildInboxItems(baseInput());
    expect(result).toEqual([]);
  });

  it('returns a single weeklyReview item when weeklyReviewDue is true alone', () => {
    const result = buildInboxItems(baseInput({ weeklyReviewDue: true }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'weeklyReview:weekly',
      kind: 'weeklyReview',
      ticker: null,
    });
  });

  it('orders items by the binding kind order across all 8 kinds, stable within kind', () => {
    const review = makeEmptyReview({
      positionsClose: [makeClose({ ticker: 'AAPL' }), makeClose({ ticker: 'ZZZZ', positionId: 'pos-close-2' })],
      positionsUpdateStop: [makeUpdate({ ticker: 'MSFT' })],
      positionsExitSignal: [makeExitSignal({ ticker: 'NVDA' })],
      pendingOrdersReview: [makePendingOrder({ ticker: 'TSLA', category: 'stale' })],
      positionsAddOnCandidates: [makeCandidate({ ticker: 'AMD' })],
      newCandidates: [makeCandidate({ ticker: 'GOOG' })],
      watchlistNearTrigger: [makeWatchItem({ ticker: 'ASML' })],
    });

    const result = buildInboxItems(baseInput({ review, weeklyReviewDue: true }));

    expect(result.map((i) => i.kind)).toEqual([
      'close',
      'close',
      'updateStop',
      'exitSignal',
      'staleOrder',
      'addOn',
      'newCandidate',
      'watch',
      'weeklyReview',
    ]);
    // Stable within kind: AAPL before ZZZZ, as declared in the source array.
    expect(result[0].ticker).toBe('AAPL');
    expect(result[1].ticker).toBe('ZZZZ');
  });

  it('excludes pending orders with category still_valid', () => {
    const review = makeEmptyReview({
      pendingOrdersReview: [
        makePendingOrder({ orderId: 'ord-valid', category: 'still_valid' }),
        makePendingOrder({ orderId: 'ord-stale', category: 'stale' }),
      ],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('ord-stale');
  });

  it('derives staleOrder reason from note when present, else the category', () => {
    const review = makeEmptyReview({
      pendingOrdersReview: [
        makePendingOrder({ orderId: 'ord-note', category: 'stale', note: 'Price moved away.' }),
        makePendingOrder({ orderId: 'ord-no-note', category: 'no_data', note: undefined }),
      ],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result[0].reason).toBe('Price moved away.');
    expect(result[1].reason).toBe('no_data');
  });

  it('updateStop items carry stopCurrent, stopSuggested, and a narrowed exhaustionLabel', () => {
    const review = makeEmptyReview({
      positionsUpdateStop: [
        makeUpdate({ ticker: 'MSFT', stopCurrent: 380, stopSuggested: 395, exhaustionLabel: 'exit' }),
      ],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result[0]).toMatchObject({
      kind: 'updateStop',
      stopCurrent: 380,
      stopSuggested: 395,
      exhaustionLabel: 'exit',
    });
  });

  it('drops an unrecognized exhaustionLabel value rather than passing it through', () => {
    const review = makeEmptyReview({
      positionsUpdateStop: [makeUpdate({ exhaustionLabel: 'weird-value' })],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result[0].exhaustionLabel).toBeUndefined();
  });

  it('links close/updateStop/exitSignal items to their PositionWithMetrics via positionById', () => {
    const position = makePosition({ ticker: 'AAPL' });
    const review = makeEmptyReview({
      positionsClose: [makeClose({ ticker: 'AAPL', positionId: 'pos-1' })],
    });
    const positionById = new Map([['pos-1', position]]);
    const result = buildInboxItems(baseInput({ review, positionById }));
    expect(result[0].position).toBe(position);
  });

  it('leaves position undefined when positionById has no match', () => {
    const review = makeEmptyReview({
      positionsClose: [makeClose({ ticker: 'AAPL', positionId: 'pos-missing' })],
    });
    const result = buildInboxItems(baseInput({ review, positionById: new Map() }));
    expect(result[0].position).toBeUndefined();
  });

  it('attaches positionSignal from the intelligence map for close/exitSignal, but not updateStop', () => {
    const review = makeEmptyReview({
      positionsClose: [makeClose({ ticker: 'AAPL', positionId: 'pos-1' })],
      positionsUpdateStop: [makeUpdate({ ticker: 'MSFT', positionId: 'pos-2' })],
      positionsExitSignal: [makeExitSignal({ ticker: 'NVDA', positionId: 'pos-3' })],
    });
    const intelligenceByTicker = new Map([
      ['AAPL', makeIntelligenceSummary('AAPL', 'pos-1', 'EXIT')],
      ['MSFT', makeIntelligenceSummary('MSFT', 'pos-2', 'TRIM')],
      ['NVDA', makeIntelligenceSummary('NVDA', 'pos-3', 'HOLD')],
    ]);
    const result = buildInboxItems(baseInput({ review, intelligenceByTicker }));
    const byTicker = new Map(result.map((i) => [i.ticker, i]));
    expect(byTicker.get('AAPL')?.positionSignal).toBe('EXIT');
    expect(byTicker.get('MSFT')?.positionSignal).toBeUndefined();
    expect(byTicker.get('NVDA')?.positionSignal).toBe('HOLD');
  });

  it('leaves positionSignal undefined when there is no intelligence for the ticker', () => {
    const review = makeEmptyReview({ positionsClose: [makeClose({ ticker: 'AAPL' })] });
    const result = buildInboxItems(baseInput({ review }));
    expect(result[0].positionSignal).toBeUndefined();
  });

  it('passes positionsClose/positionsUpdateStop/positionsExitSignal reason through verbatim', () => {
    const review = makeEmptyReview({
      positionsClose: [makeClose({ reason: 'AAPL closed below stop.' })],
      positionsUpdateStop: [makeUpdate({ reason: 'Trail stop up.' })],
      positionsExitSignal: [makeExitSignal({ reason: 'NVDA below SMA20.' })],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result.map((i) => i.reason)).toEqual(['AAPL closed below stop.', 'Trail stop up.', 'NVDA below SMA20.']);
  });

  it('does not produce inbox items for positionsHold', () => {
    const review = makeEmptyReview({
      positionsHold: [
        {
          positionId: 'pos-hold-1',
          ticker: 'HOLD1',
          entryPrice: 10,
          stopPrice: 9,
          currentPrice: 11,
          rNow: 0.5,
          daysOpen: 2,
          timeStopWarning: false,
          reason: 'hold',
          exhaustionScore: null,
          exhaustionLabel: null,
        },
      ],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result).toEqual([]);
  });

  it('derives newCandidate/addOn reason from decisionSummary.whyNow when present', () => {
    const review = makeEmptyReview({
      newCandidates: [
        makeCandidate({
          ticker: 'GOOG',
          signal: 'breakout',
          decisionSummary: {
            symbol: 'GOOG',
            action: 'BUY_NOW',
            conviction: 'high',
            technicalLabel: 'strong',
            fundamentalsLabel: 'strong',
            valuationLabel: 'fair',
            catalystLabel: 'active',
            whyNow: 'Setup is ready now.',
            whatToDo: 'Buy.',
            mainRisk: 'Execution.',
            tradePlan: {},
            valuationContext: { method: 'not_available' },
            drivers: { positives: [], negatives: [], warnings: [] },
          },
        }),
      ],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result[0].reason).toBe('Setup is ready now.');
    expect(result[0].candidate?.ticker).toBe('GOOG');
  });

  it('falls back to recommendation.reasonsShort[0] then signal when decisionSummary is absent', () => {
    const review = makeEmptyReview({
      newCandidates: [
        makeCandidate({
          ticker: 'META',
          signal: 'pullback',
          recommendation: {
            verdict: 'RECOMMENDED',
            reasonsShort: ['Strong relative strength.'],
            reasonsDetailed: [],
            risk: { entry: 150, riskAmount: 10, riskPct: 1, positionSize: 1000, shares: 10 },
            costs: { commissionEstimate: 1, fxEstimate: 0, slippageEstimate: 0.5, totalCost: 1.5 },
            checklist: [],
            education: {
              commonBiasWarning: 'n/a',
              whatToLearn: 'n/a',
              whatWouldMakeValid: [],
            },
          },
        }),
        makeCandidate({ ticker: 'PLTR', signal: 'range_break' }),
      ],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result[0].reason).toBe('Strong relative strength.');
    expect(result[1].reason).toBe('range_break');
  });

  it('maps watchlistNearTrigger items carrying distanceToTriggerPct', () => {
    const review = makeEmptyReview({
      watchlistNearTrigger: [makeWatchItem({ ticker: 'ASML', distanceToTriggerPct: -1.3 })],
    });
    const result = buildInboxItems(baseInput({ review }));
    expect(result[0]).toMatchObject({
      kind: 'watch',
      ticker: 'ASML',
      distanceToTriggerPct: -1.3,
    });
  });
});
