import { describe, expect, it } from 'vitest';
import {
  transformDailyReview,
  transformPositionExitSignal,
  type DailyReviewAPI,
  type DailyReviewPositionExitSignalAPI,
} from '@/features/dailyReview/types';

describe('transformDailyReview', () => {
  it('maps candidate close and execution guidance fields', () => {
    const apiPayload: DailyReviewAPI = {
      watchlist_near_trigger: [
        {
          ticker: 'ASML',
          watched_at: '2026-05-01T10:00:00Z',
          watch_price: 660,
          currency: 'EUR',
          source: 'screener',
          current_price: 671,
          signal_trigger_price: 680,
          distance_to_trigger_pct: -1.3,
          price_history: [],
        },
      ],
      new_candidates: [
        {
          ticker: 'AAPL',
          currency: 'USD',
          rank: 2,
          priority_rank: 1,
          confidence: 80,
          signal: 'breakout',
          close: 100,
          score: 83.2,
          atr: 2.4,
          sma_20: 98,
          sma_50: 96,
          sma_200: 90,
          momentum_6m: 0.15,
          momentum_12m: 0.24,
          rel_strength: 0.08,
          entry: 101,
          stop: 97,
          shares: 10,
          r_reward: 2.3,
          name: 'Apple',
          sector: 'Tech',
          suggested_order_type: 'BUY_STOP',
          suggested_order_price: 101.2,
          execution_note: 'Breakout not triggered yet. Place BUY STOP slightly above breakout_level.',
          decision_summary: {
            symbol: 'AAPL',
            action: 'BUY_NOW',
            conviction: 'high',
            technical_label: 'strong',
            fundamentals_label: 'strong',
            valuation_label: 'fair',
            catalyst_label: 'active',
            why_now: 'Ready now.',
            what_to_do: 'Act.',
            main_risk: 'Execution.',
            trade_plan: {
              entry: 101,
              stop: 97,
              target: 109,
              rr: 2.3,
            },
            valuation_context: {
              method: 'earnings_multiple',
            },
            drivers: {
              positives: ['Ready.'],
            },
          },
        },
      ],
      positions_add_on_candidates: [],
      positions_hold: [],
      positions_update_stop: [],
      positions_close: [],
      summary: {
        total_positions: 0,
        no_action: 0,
        update_stop: 0,
        close_positions: 0,
        new_candidates: 1,
        add_on_candidates: 0,
        watchlist_near_trigger: 1,
        review_date: '2026-03-02',
      },
    };

    const result = transformDailyReview(apiPayload);
    expect(result.watchlistNearTrigger[0].ticker).toBe('ASML');
    expect(result.summary.watchlistNearTrigger).toBe(1);
    expect(result.newCandidates[0].close).toBe(100);
    expect(result.newCandidates[0].currency).toBe('USD');
    expect(result.newCandidates[0].score).toBe(83.2);
    expect(result.newCandidates[0].atr).toBe(2.4);
    expect(result.newCandidates[0].sma20).toBe(98);
    expect(result.newCandidates[0].rank).toBe(2);
    expect(result.newCandidates[0].priorityRank).toBe(1);
    expect(result.newCandidates[0].suggestedOrderType).toBe('BUY_STOP');
    expect(result.newCandidates[0].suggestedOrderPrice).toBe(101.2);
    expect(result.newCandidates[0].executionNote).toContain('BUY STOP');
    expect(result.newCandidates[0].decisionSummary?.action).toBe('BUY_NOW');
  });

  it('transforms positions_exit_signal with camelCase and defaults', () => {
    const api: DailyReviewPositionExitSignalAPI = {
      position_id: 'pos-1',
      ticker: 'MSFT',
      entry_price: 400,
      stop_price: 380,
      current_price: 370,
      r_now: -1.5,
      reason: 'MSFT below SMA20 for 2d (-3.2% below). -1.50R, 10d held. Stop 2.7% away.',
    };
    const result = transformPositionExitSignal(api);
    expect(result.positionId).toBe('pos-1');
    expect(result.ticker).toBe('MSFT');
    expect(result.rNow).toBe(-1.5);
    expect(result.daysOpen).toBe(0);
    expect(result.reason).toContain('SMA20');
  });

  it('transformDailyReview includes positionsExitSignal and exitSignal count', () => {
    const basePayload: DailyReviewAPI = {
      new_candidates: [],
      positions_add_on_candidates: [],
      positions_hold: [],
      positions_update_stop: [],
      positions_close: [],
      positions_exit_signal: [
        {
          position_id: 'pos-2',
          ticker: 'NVDA',
          entry_price: 800,
          stop_price: 760,
          current_price: 750,
          r_now: -1.25,
          days_open: 8,
          reason: 'NVDA below SMA20 for 2d (-5.0% below). -1.25R, 8d held. Stop 1.3% away.',
        },
      ],
      summary: {
        total_positions: 1,
        no_action: 0,
        update_stop: 0,
        close_positions: 0,
        exit_signal: 1,
        new_candidates: 0,
        add_on_candidates: 0,
        review_date: '2026-05-20',
      },
    };
    const result = transformDailyReview(basePayload);
    expect(result.positionsExitSignal).toHaveLength(1);
    expect(result.positionsExitSignal[0].ticker).toBe('NVDA');
    expect(result.positionsExitSignal[0].daysOpen).toBe(8);
    expect(result.summary.exitSignal).toBe(1);
  });
});
