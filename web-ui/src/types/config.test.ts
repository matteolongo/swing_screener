import { describe, expect, it } from 'vitest';

import { toAppConfigAPI, transformAppConfig } from './config';

describe('config transforms', () => {
  it('round-trips current backend risk and manage fields', () => {
    const config = transformAppConfig({
      risk: {
        account_size: 50000,
        risk_pct: 0.01,
        max_position_pct: 0.6,
        min_shares: 1,
        k_atr: 2,
        min_rr: 2,
        max_fee_risk_pct: 0.2,
        max_concentration_pct: 60,
        account_size_mode: 'equity',
        account_currency: 'EUR',
      },
      indicators: {
        sma_fast: 20,
        sma_mid: 50,
        sma_long: 200,
        atr_window: 14,
        lookback_6m: 126,
        lookback_12m: 252,
        benchmark: 'SPY',
        breakout_lookback: 50,
        pullback_ma: 20,
        min_history: 260,
      },
      manage: {
        breakeven_at_r: 1,
        trail_after_r: 2,
        trail_sma: 20,
        sma_buffer_pct: 0.005,
        max_holding_days: 20,
        time_stop_days: 15,
        time_stop_min_r: 0.5,
        exit_signal_days: 2,
      },
      positions_file: 'data/positions.json',
      orders_file: 'data/orders.json',
    });

    expect(config.risk.maxConcentrationPct).toBe(60);
    expect(config.risk.accountSizeMode).toBe('equity');
    expect(config.risk.accountCurrency).toBe('EUR');
    expect(config.manage.exitSignalDays).toBe(2);
    expect(toAppConfigAPI(config).risk.max_concentration_pct).toBe(60);
    expect(toAppConfigAPI(config).risk.account_size_mode).toBe('equity');
    expect(toAppConfigAPI(config).risk.account_currency).toBe('EUR');
    expect(toAppConfigAPI(config).manage.exit_signal_days).toBe(2);
  });
});
