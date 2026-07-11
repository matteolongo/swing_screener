import { describe, expect, it } from 'vitest';

import { transformEvidenceLedger } from '@/features/intelligence/types';

describe('transformEvidenceLedger', () => {
  it('maps snake_case ledger to camelCase and null-safes', () => {
    expect(transformEvidenceLedger(null)).toBeNull();

    const out = transformEvidenceLedger({
      contributions: [
        {
          key: 'insider_activity',
          label: 'Insider',
          category: 'positioning',
          direction: 'bullish',
          weight: 10,
          contribution: 10,
          source: 'Finnhub',
          event_date: '2026-05-08',
          explanation: 'Recent insider activity is net positive.',
        },
      ],
      bull_weight: 10,
      bear_weight: 0,
      net: 10,
      balance_label: 'bullish',
    });

    expect(out).not.toBeNull();
    expect(out?.balanceLabel).toBe('bullish');
    expect(out?.bullWeight).toBe(10);
    expect(out?.contributions[0].key).toBe('insider_activity');
    expect(out?.contributions[0].eventDate).toBe('2026-05-08');
    expect(out?.contributions[0].explanation).toBe('Recent insider activity is net positive.');
  });
});
