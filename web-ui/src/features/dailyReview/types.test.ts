import { describe, expect, it } from 'vitest';
import { transformDailyReview, type DailyReviewAPI } from '@/features/dailyReview/types';

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
});
