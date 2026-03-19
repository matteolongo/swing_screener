import { describe, expect, it } from 'vitest';
import { transformDailyReview, type DailyReviewAPI } from '@/features/dailyReview/types';

describe('transformDailyReview', () => {
  it('maps candidate close and execution guidance fields', () => {
    const apiPayload: DailyReviewAPI = {
      new_candidates: [
        {
          ticker: 'AAPL',
          rank: 2,
          priority_rank: 1,
          confidence: 80,
          signal: 'breakout',
          close: 100,
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
        review_date: '2026-03-02',
      },
    };

    const result = transformDailyReview(apiPayload);
    expect(result.newCandidates[0].close).toBe(100);
    expect(result.newCandidates[0].rank).toBe(2);
    expect(result.newCandidates[0].priorityRank).toBe(1);
    expect(result.newCandidates[0].suggestedOrderType).toBe('BUY_STOP');
    expect(result.newCandidates[0].suggestedOrderPrice).toBe(101.2);
    expect(result.newCandidates[0].executionNote).toContain('BUY STOP');
    expect(result.newCandidates[0].decisionSummary?.action).toBe('BUY_NOW');
  });
});
