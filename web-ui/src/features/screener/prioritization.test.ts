import { describe, expect, it } from 'vitest';

import { filterCandidates, prioritizeCandidates } from '@/features/screener/prioritization';
import type { ScreenerCandidate } from '@/features/screener/types';

function buildCandidate(
  ticker: string,
  {
    rank,
    confidence,
    action,
    conviction,
    verdict,
  }: {
    rank: number;
    confidence: number;
    action: NonNullable<ScreenerCandidate['decisionSummary']>['action'];
    conviction: NonNullable<ScreenerCandidate['decisionSummary']>['conviction'];
    verdict?: 'RECOMMENDED' | 'NOT_RECOMMENDED';
  }
): ScreenerCandidate {
  return {
    ticker,
    currency: 'USD',
    close: 100,
    sma20: 98,
    sma50: 95,
    sma200: 90,
    atr: 2,
    momentum6m: 0.2,
    momentum12m: 0.3,
    relStrength: 1.1,
    score: 0.8,
    confidence,
    rank,
    recommendation: verdict
      ? {
          verdict,
          reasonsShort: [],
          reasonsDetailed: [],
          risk: { entry: 100, riskAmount: 100, riskPct: 0.01, positionSize: 1000, shares: 10 },
          costs: { commissionEstimate: 1, fxEstimate: 0, slippageEstimate: 1, totalCost: 2 },
          checklist: [],
          education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
        }
      : undefined,
    decisionSummary: {
      symbol: ticker,
      action,
      conviction,
      technicalLabel: 'strong',
      fundamentalsLabel: 'strong',
      valuationLabel: 'fair',
      catalystLabel: 'active',
      whyNow: 'Why now.',
      whatToDo: 'What to do.',
      mainRisk: 'Main risk.',
      tradePlan: {},
      valuationContext: { method: 'not_available' },
      drivers: { positives: [], negatives: [], warnings: [] },
    },
  };
}

describe('prioritizeCandidates', () => {
  it('sorts by decision action then conviction and keeps raw rank as tie-breaker', () => {
    const candidates = [
      buildCandidate('WATCH', { rank: 1, confidence: 90, action: 'WATCH', conviction: 'high' }),
      buildCandidate('PULLBACK', { rank: 4, confidence: 70, action: 'BUY_ON_PULLBACK', conviction: 'medium' }),
      buildCandidate('BUY-MED', { rank: 3, confidence: 80, action: 'BUY_NOW', conviction: 'medium' }),
      buildCandidate('BUY-HIGH', { rank: 5, confidence: 75, action: 'BUY_NOW', conviction: 'high' }),
    ];

    const prioritized = prioritizeCandidates(candidates);

    expect(prioritized.map((candidate) => candidate.ticker)).toEqual([
      'BUY-HIGH',
      'BUY-MED',
      'PULLBACK',
      'WATCH',
    ]);
    expect(prioritized.map((candidate) => candidate.priorityRank)).toEqual([1, 2, 3, 4]);
    expect(prioritized.map((candidate) => candidate.rank)).toEqual([5, 3, 4, 1]);
  });
});

describe('filterCandidates', () => {
  it('filters by action and recommendation verdict independently', () => {
    const candidates = prioritizeCandidates([
      buildCandidate('BUY-REC', {
        rank: 2,
        confidence: 80,
        action: 'BUY_NOW',
        conviction: 'high',
        verdict: 'RECOMMENDED',
      }),
      buildCandidate('BUY-NOTREC', {
        rank: 1,
        confidence: 78,
        action: 'BUY_NOW',
        conviction: 'medium',
        verdict: 'NOT_RECOMMENDED',
      }),
      buildCandidate('WATCH-REC', {
        rank: 3,
        confidence: 75,
        action: 'WATCH',
        conviction: 'medium',
        verdict: 'RECOMMENDED',
      }),
    ]);

    expect(filterCandidates(candidates, { recommendedOnly: false, actionFilter: 'BUY_NOW' }).map((c) => c.ticker)).toEqual([
      'BUY-REC',
      'BUY-NOTREC',
    ]);
    expect(filterCandidates(candidates, { recommendedOnly: true, actionFilter: 'BUY_NOW' }).map((c) => c.ticker)).toEqual([
      'BUY-REC',
    ]);
  });
});
