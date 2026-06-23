import { describe, expect, it } from 'vitest';

import { transformEventStudyResponse } from './types';
import type { EventStudyResponseAPI } from './types';

const apiResponse: EventStudyResponseAPI = {
  tickers: ['TEST'],
  start: '2022-01-01',
  end: '2022-02-01',
  config_used: { pattern_stop_enabled: false },
  trades: [
    {
      ticker: 'TEST',
      setup: 'breakout',
      entry_date: '2022-01-10',
      entry_price: 110,
      initial_stop: 104.57,
      initial_risk: 5.43,
      target: 120.86,
      exit_date: '2022-01-11',
      exit_price: 104.57,
      exit_reason: 'stop_hit',
      r_multiple: -1,
      bars_held: 1,
      mfe_r: 0,
      mae_r: -3.68,
      pattern_stop_fired: false,
    },
  ],
  metrics: {
    n_trades: 1,
    win_rate: 0,
    expectancy_r: -1,
    total_r: -1,
    profit_factor: null,
    avg_win_r: 0,
    avg_loss_r: -1,
    avg_bars_held: 1,
    max_drawdown_r: 1,
    exit_reason_counts: { stop_hit: 1 },
    by_setup: {
      breakout: {
        n_trades: 1,
        win_rate: 0,
        expectancy_r: -1,
        total_r: -1,
        profit_factor: null,
        avg_win_r: 0,
        avg_loss_r: -1,
        avg_bars_held: 1,
        max_drawdown_r: 1,
        exit_reason_counts: { stop_hit: 1 },
      },
    },
  },
};

describe('transformEventStudyResponse', () => {
  it('maps snake_case API fields to the camelCase UI model', () => {
    const result = transformEventStudyResponse(apiResponse);

    expect(result.tickers).toEqual(['TEST']);
    expect(result.start).toBe('2022-01-01');
    expect(result.trades).toHaveLength(1);

    const trade = result.trades[0];
    expect(trade.entryDate).toBe('2022-01-10');
    expect(trade.entryPrice).toBe(110);
    expect(trade.initialStop).toBe(104.57);
    expect(trade.exitReason).toBe('stop_hit');
    expect(trade.rMultiple).toBe(-1);
    expect(trade.barsHeld).toBe(1);
    expect(trade.patternStopFired).toBe(false);
  });

  it('maps metrics including null profit factor and per-setup breakdown', () => {
    const { metrics } = transformEventStudyResponse(apiResponse);

    expect(metrics.nTrades).toBe(1);
    expect(metrics.winRate).toBe(0);
    expect(metrics.expectancyR).toBe(-1);
    expect(metrics.maxDrawdownR).toBe(1);
    expect(metrics.profitFactor).toBeNull();
    expect(metrics.exitReasonCounts).toEqual({ stop_hit: 1 });
    expect(metrics.bySetup.breakout.nTrades).toBe(1);
    expect(metrics.bySetup.breakout.expectancyR).toBe(-1);
  });
});
