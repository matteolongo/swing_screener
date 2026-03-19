import { describe, expect, it } from 'vitest';

import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import {
  rebuildDecisionSummaryWithFundamentals,
  syncCandidateWithFundamentals,
} from '@/features/screener/decisionSummary';
import type { ScreenerCandidate } from '@/features/screener/types';

function buildCandidate(): ScreenerCandidate {
  return {
    ticker: 'AAPL',
    currency: 'USD',
    close: 180,
    sma20: 175,
    sma50: 170,
    sma200: 160,
    atr: 3,
    momentum6m: 0.18,
    momentum12m: 0.27,
    relStrength: 0.09,
    score: 0.82,
    confidence: 79,
    rank: 1,
    signal: 'breakout',
    entry: 180,
    stop: 171,
    target: 198,
    rr: 2,
    decisionSummary: {
      symbol: 'AAPL',
      action: 'WATCH',
      conviction: 'low',
      technicalLabel: 'strong',
      fundamentalsLabel: 'neutral',
      valuationLabel: 'unknown',
      catalystLabel: 'active',
      whyNow: 'Old summary',
      whatToDo: 'Old action',
      mainRisk: 'Old risk',
      tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
      valuationContext: {
        method: 'not_available',
        summary: 'Valuation context is limited because no cached fundamentals snapshot is available yet.',
      },
      drivers: { positives: [], negatives: [], warnings: ['No cached fundamentals snapshot is available yet.'] },
    },
  };
}

function buildSnapshot(): FundamentalSnapshot {
  return {
    symbol: 'AAPL',
    asofDate: '2026-03-19',
    provider: 'yfinance',
    updatedAt: '2026-03-19T10:00:00',
    instrumentType: 'equity',
    supported: true,
    coverageStatus: 'supported',
    freshnessStatus: 'current',
    trailingPe: 24.6,
    priceToSales: 5.1,
    pillars: {
      growth: { score: 0.9, status: 'strong', summary: 'Growth profile.' },
      profitability: { score: 0.9, status: 'strong', summary: 'Profitability profile.' },
      balance_sheet: { score: 0.9, status: 'strong', summary: 'Balance sheet profile.' },
      cash_flow: { score: 0.9, status: 'strong', summary: 'Cash flow profile.' },
      valuation: { score: 0.55, status: 'neutral', summary: 'Valuation profile.' },
    },
    historicalSeries: {},
    metricContext: {},
    dataQualityStatus: 'high',
    dataQualityFlags: [],
    redFlags: [],
    highlights: ['Growth metrics are supportive.'],
    metricSources: {},
  };
}

describe('rebuildDecisionSummaryWithFundamentals', () => {
  it('rebuilds valuation context from the loaded snapshot', () => {
    const rebuilt = rebuildDecisionSummaryWithFundamentals(buildCandidate(), buildSnapshot());

    expect(rebuilt.fundamentalsLabel).toBe('strong');
    expect(rebuilt.valuationContext.method).toBe('earnings_multiple');
    expect(rebuilt.valuationContext.fairValueBase).toBe(193.17);
    expect(rebuilt.valuationContext.summary).toContain('Trailing PE is 24.6x');
  });

  it('patches a stale candidate in place with the loaded fundamentals snapshot', () => {
    const patched = syncCandidateWithFundamentals(buildCandidate(), buildSnapshot());

    expect(patched.fundamentalsCoverageStatus).toBe('supported');
    expect(patched.fundamentalsFreshnessStatus).toBe('current');
    expect(patched.fundamentalsSummary).toBe('Growth metrics are supportive.');
    expect(patched.decisionSummary?.valuationContext.method).toBe('earnings_multiple');
  });

  it('falls back to book multiple when earnings and sales inputs are unavailable', () => {
    const snapshot = {
      ...buildSnapshot(),
      trailingPe: undefined,
      priceToSales: undefined,
      bookValuePerShare: 20,
      priceToBook: 2.5,
      bookToPrice: 0.4,
    } satisfies FundamentalSnapshot;

    const rebuilt = rebuildDecisionSummaryWithFundamentals(
      {
        ...buildCandidate(),
        close: 50,
      },
      snapshot
    );

    expect(rebuilt.valuationContext.method).toBe('book_multiple');
    expect(rebuilt.valuationContext.fairValueBase).toBe(69.3);
    expect(rebuilt.valuationContext.summary).toContain('using book multiple');
    expect(rebuilt.valuationContext.summary).toContain('book value per share is 20.00');
  });

  it('prefers book-based valuation context for financials', () => {
    const rebuilt = rebuildDecisionSummaryWithFundamentals(
      {
        ...buildCandidate(),
        close: 50,
        sector: 'Financial Services',
      },
      {
        ...buildSnapshot(),
        sector: 'Financial Services',
        trailingPe: 12,
        priceToSales: 3.8,
        bookValuePerShare: 20,
        priceToBook: 2.5,
        bookToPrice: 0.4,
      }
    );

    expect(rebuilt.valuationContext.method).toBe('book_multiple');
    expect(rebuilt.valuationContext.summary).toContain(
      'For financials, book-based valuation carries more weight'
    );
  });

  it('deemphasizes book value for software and high-growth valuation labels', () => {
    const rebuilt = rebuildDecisionSummaryWithFundamentals(
      {
        ...buildCandidate(),
        close: 80,
        sector: 'Technology',
      },
      {
        ...buildSnapshot(),
        sector: 'Technology',
        trailingPe: undefined,
        priceToSales: 7.5,
        bookValuePerShare: 4,
        priceToBook: 20,
        bookToPrice: 0.05,
        pillars: {
          ...buildSnapshot().pillars,
          valuation: { score: 0.2, status: 'weak', summary: 'Valuation profile.' },
        },
      }
    );

    expect(rebuilt.valuationLabel).toBe('fair');
    expect(rebuilt.valuationContext.method).toBe('sales_multiple');
    expect(rebuilt.valuationContext.summary).toContain(
      'sales multiples carry more weight than book value'
    );
  });

  it('leans on earnings and cash generation for mature cashflow sectors', () => {
    const rebuilt = rebuildDecisionSummaryWithFundamentals(
      {
        ...buildCandidate(),
        close: 90,
        sector: 'Utilities',
      },
      {
        ...buildSnapshot(),
        sector: 'Utilities',
        trailingPe: 18,
        priceToSales: 5.5,
        pillars: {
          ...buildSnapshot().pillars,
          valuation: { score: 0.2, status: 'weak', summary: 'Valuation profile.' },
        },
      }
    );

    expect(rebuilt.valuationLabel).toBe('fair');
    expect(rebuilt.valuationContext.method).toBe('earnings_multiple');
    expect(rebuilt.valuationContext.summary).toContain(
      'earnings and cash generation carry more weight than sales multiples'
    );
  });
});
