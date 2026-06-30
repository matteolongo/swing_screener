import { describe, it, expect } from 'vitest';
import { dailyReviewSelectionKey } from './api';
import { toTaxonomyFilterPayload } from '@/features/pool/types';

describe('dailyReviewSelectionKey', () => {
  it('is empty for an empty selection', () => {
    expect(dailyReviewSelectionKey(undefined)).toBe('');
    expect(dailyReviewSelectionKey({})).toBe('|');
  });

  it('encodes preset and a non-empty taxonomy filter', () => {
    const key = dailyReviewSelectionKey({
      presetId: 'broad_market',
      taxonomyFilter: { region: ['us'] },
    });
    expect(key).toContain('broad_market');
    expect(key).toContain('region');
  });

  it('ignores an all-empty taxonomy filter', () => {
    expect(dailyReviewSelectionKey({ presetId: 'x', taxonomyFilter: {} })).toBe('x|');
  });
});

describe('toTaxonomyFilterPayload', () => {
  it('maps camelCase to snake_case including coarse instrument_type', () => {
    expect(
      toTaxonomyFilterPayload({ instrumentType: ['etf'], marketCapTier: ['large'] }),
    ).toMatchObject({ instrument_type: ['etf'], market_cap_tier: ['large'] });
  });
});
