import { describe, it, expect } from 'vitest';
import { transformReviewEntry, transformPreset } from './types';

describe('transformReviewEntry', () => {
  it('maps snake_case API entry to camelCase', () => {
    const out = transformReviewEntry({
      symbol: 'AAPL',
      exchange_mic: 'XNAS',
      fetch_failure_count: 3,
      first_failed_at: '2026-06-28',
      last_failed_at: '2026-06-30',
      reason: 'no data',
    });
    expect(out).toEqual({
      symbol: 'AAPL',
      exchangeMic: 'XNAS',
      capTier: undefined,
      sector: undefined,
      provider: undefined,
      failureCount: 3,
      firstFailedAt: '2026-06-28',
      lastFailedAt: '2026-06-30',
      reason: 'no data',
    });
  });
});

describe('transformPreset', () => {
  it('maps snake_case filter keys to camelCase', () => {
    const out = transformPreset({
      id: 'us_large_cap_equities',
      label: 'US Large Cap Equities',
      filter: { region: ['us'], market_cap_tier: ['large'], instrument_type_detail: ['equity'] },
    });
    expect(out.id).toBe('us_large_cap_equities');
    expect(out.label).toBe('US Large Cap Equities');
    expect(out.filter).toEqual({
      region: ['us'],
      marketCapTier: ['large'],
      instrumentTypeDetail: ['equity'],
      sector: undefined,
      indexMemberships: undefined,
      provider: undefined,
      currency: undefined,
      exchangeMics: undefined,
      liquidityTier: undefined,
    });
  });
});
