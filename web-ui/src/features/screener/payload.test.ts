import { describe, it, expect } from 'vitest';
import { toScreenerRequestPayload } from './api';

describe('toScreenerRequestPayload', () => {
  it('serializes taxonomyFilter to snake_case and keeps preset', () => {
    const payload = toScreenerRequestPayload({
      top: 20,
      taxonomyFilter: {
        region: ['us'],
        marketCapTier: ['large'],
        indexMemberships: ['us_sp500'],
        instrumentTypeDetail: ['equity'],
      },
      preset: 'us_large_cap_equities',
    });
    expect(payload.taxonomy_filter).toEqual({
      region: ['us'],
      market_cap_tier: ['large'],
      sector: undefined,
      index_memberships: ['us_sp500'],
      instrument_type_detail: ['equity'],
      provider: undefined,
      currency: undefined,
      exchange_mics: undefined,
      liquidity_tier: undefined,
    });
    expect(payload.preset).toBe('us_large_cap_equities');
  });

  it('omits taxonomy_filter when not provided', () => {
    const payload = toScreenerRequestPayload({ top: 10, forceRefresh: true });
    expect(payload.taxonomy_filter).toBeUndefined();
    expect(payload.force_refresh).toBe(true);
    expect(payload.top).toBe(10);
  });
});
