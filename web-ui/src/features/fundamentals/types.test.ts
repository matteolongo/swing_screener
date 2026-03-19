import { describe, expect, it } from 'vitest';

import {
  transformFundamentalSnapshot,
  transformFundamentalsWarmupLaunchResponse,
  transformFundamentalsWarmupStatus,
} from '@/features/fundamentals/types';

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
      historical_series: {
        revenue: {
          label: 'Revenue',
          unit: 'currency',
          direction: 'improving',
          points: [
            { period_end: '2025-08-01', value: 84_000_000_000 },
            { period_end: '2025-11-01', value: 88_000_000_000 },
            { period_end: '2026-02-01', value: 94_000_000_000 },
          ],
        },
      },
      red_flags: [],
      highlights: ['Growth metrics are supportive.'],
      metric_sources: { revenue_growth_yoy: 'yfinance' },
    });

    expect(snapshot.asofDate).toBe('2026-03-18');
    expect(snapshot.companyName).toBe('Apple Inc.');
    expect(snapshot.pillars.growth.status).toBe('strong');
    expect(snapshot.historicalSeries.revenue.direction).toBe('improving');
    expect(snapshot.historicalSeries.revenue.points).toHaveLength(3);
    expect(snapshot.metricSources.revenue_growth_yoy).toBe('yfinance');
  });

  it('maps warmup launch and status payloads to UI shape', () => {
    const launch = transformFundamentalsWarmupLaunchResponse({
      job_id: 'warmup-1',
      status: 'queued',
      source: 'watchlist',
      force_refresh: false,
      total_symbols: 8,
      created_at: '2026-03-19T10:00:00',
      updated_at: '2026-03-19T10:00:00',
    });
    const status = transformFundamentalsWarmupStatus({
      job_id: 'warmup-1',
      status: 'running',
      source: 'symbols',
      force_refresh: true,
      total_symbols: 3,
      completed_symbols: 2,
      coverage_counts: {
        supported: 1,
        partial: 1,
        insufficient: 0,
        unsupported: 0,
      },
      freshness_counts: {
        current: 2,
        stale: 0,
        unknown: 0,
      },
      error_count: 0,
      last_completed_symbol: 'MSFT',
      error_sample: null,
      created_at: '2026-03-19T10:00:00',
      updated_at: '2026-03-19T10:00:03',
    });

    expect(launch.jobId).toBe('warmup-1');
    expect(launch.totalSymbols).toBe(8);
    expect(status.completedSymbols).toBe(2);
    expect(status.coverageCounts.partial).toBe(1);
    expect(status.lastCompletedSymbol).toBe('MSFT');
  });
});
