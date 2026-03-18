import { describe, expect, it } from 'vitest';

import { transformFundamentalSnapshot } from '@/features/fundamentals/types';

describe('fundamentals transforms', () => {
  it('maps API snapshot payload to UI shape', () => {
    const snapshot = transformFundamentalSnapshot({
      symbol: 'AAPL',
      asof_date: '2026-03-18',
      provider: 'yfinance',
      updated_at: '2026-03-18T10:00:00',
      instrument_type: 'equity',
      supported: true,
      coverage_status: 'supported',
      freshness_status: 'current',
      company_name: 'Apple Inc.',
      sector: 'Technology',
      currency: 'USD',
      revenue_growth_yoy: 0.18,
      earnings_growth_yoy: 0.24,
      pillars: {
        growth: {
          score: 0.9,
          status: 'strong',
          summary: 'Growth profile.',
        },
      },
      red_flags: [],
      highlights: ['Growth metrics are supportive.'],
      metric_sources: { revenue_growth_yoy: 'yfinance' },
    });

    expect(snapshot.asofDate).toBe('2026-03-18');
    expect(snapshot.companyName).toBe('Apple Inc.');
    expect(snapshot.pillars.growth.status).toBe('strong');
    expect(snapshot.metricSources.revenue_growth_yoy).toBe('yfinance');
  });
});
