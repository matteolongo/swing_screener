import { describe, expect, it } from 'vitest';

import { toStrategyUpdateRequest, transformStrategy, type StrategyAPI } from './types';

function makeStrategyApi(): StrategyAPI {
  return {
    id: 'momentum',
    name: 'Momentum',
    description: null,
    module: 'momentum',
    universe: {
      trend: { sma_fast: 20, sma_mid: 50, sma_long: 200 },
      vol: { atr_window: 14 },
      mom: { lookback_6m: 126, lookback_12m: 252, benchmark: 'SPY' },
      filt: {
        min_price: 5,
        max_price: 500,
        max_atr_pct: 15,
        require_trend_ok: true,
        require_rs_positive: false,
        require_weekly_uptrend: true,
        currencies: ['USD', 'EUR'],
      },
    },
    ranking: { w_mom_6m: 0.45, w_mom_12m: 0.35, w_rs_6m: 0.2, top_n: 100 },
    signals: { breakout_lookback: 50, pullback_ma: 20, min_history: 260 },
    risk: {
      account_size: 50000,
      risk_pct: 0.01,
      max_position_pct: 0.6,
      min_shares: 1,
      k_atr: 2,
    },
    manage: {
      breakeven_at_r: 1,
      trail_after_r: 2,
      trail_sma: 20,
      sma_buffer_pct: 0.005,
      max_holding_days: 20,
      benchmark: 'SPY',
    },
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  };
}

describe('strategy transforms', () => {
  it('preserves weekly uptrend filter in both directions', () => {
    const strategy = transformStrategy(makeStrategyApi());

    expect(strategy.universe.filt.requireWeeklyUptrend).toBe(true);
    expect(toStrategyUpdateRequest(strategy).universe.filt.require_weekly_uptrend).toBe(true);
  });
});
