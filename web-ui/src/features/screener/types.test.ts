import { describe, expect, it } from 'vitest';
import { transformScreenerResponse, type ScreenerResponseAPI } from '@/features/screener/types';

describe('transformScreenerResponse', () => {
  it('maps execution guidance fields from API to UI shape', () => {
    const apiResponse: ScreenerResponseAPI = {
      asof_date: '2026-03-02',
      total_screened: 1,
      data_freshness: 'final_close',
      candidates: [
        {
          ticker: 'AAPL',
          close: 100,
          sma_20: 99,
          sma_50: 95,
          sma_200: 90,
          atr: 2,
          momentum_6m: 0.2,
          momentum_12m: 0.3,
          rel_strength: 1.1,
          score: 0.8,
          confidence: 78,
          rank: 1,
          signal: 'breakout',
          suggested_order_type: 'BUY_STOP',
          suggested_order_price: 101.2,
          execution_note: 'Breakout not triggered yet. Place BUY STOP slightly above breakout_level.',
        },
      ],
    };

    const result = transformScreenerResponse(apiResponse);
    expect(result.candidates[0].suggestedOrderType).toBe('BUY_STOP');
    expect(result.candidates[0].suggestedOrderPrice).toBe(101.2);
    expect(result.candidates[0].executionNote).toContain('BUY STOP');
  });
});

