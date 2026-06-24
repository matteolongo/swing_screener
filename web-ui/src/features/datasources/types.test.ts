import { describe, it, expect } from 'vitest';
import { transformDataSource, transformFallbackEvent } from './types';

describe('datasources transforms', () => {
  it('maps snake_case source to camelCase', () => {
    const out = transformDataSource({
      id: 'yfinance',
      display_name: 'Yahoo Finance',
      domain: 'market_data',
      role: 'primary',
      requires: null,
      configured: true,
      probeable: true,
      canary_market: 'us',
      note: null,
      last_probe: { id: 'yfinance', status: 'ok', latency_ms: 12, detail: '1 bar', sample: null, error: null },
    });
    expect(out.displayName).toBe('Yahoo Finance');
    expect(out.lastProbe?.status).toBe('ok');
    expect(out.lastProbe?.latencyMs).toBe(12);
  });

  it('maps fallback event', () => {
    const out = transformFallbackEvent({
      ts: '2026-06-24T10:00:00+00:00',
      domain: 'market_data',
      from_provider: 'yfinance',
      reason: 'empty',
      fell_back_to: 'stooq',
      tickers: ['AAPL'],
      stale_asof: null,
    });
    expect(out.fromProvider).toBe('yfinance');
    expect(out.fellBackTo).toBe('stooq');
  });
});
