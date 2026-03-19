import { describe, expect, it } from 'vitest';

import { filterDailyReviewCandidates } from '@/features/dailyReview/prioritization';
import type { DailyReviewCandidate } from '@/features/dailyReview/types';

function buildCandidate(
  ticker: string,
  {
    verdict,
    action,
  }: {
    verdict: 'RECOMMENDED' | 'NOT_RECOMMENDED';
    action: 'BUY_NOW' | 'BUY_ON_PULLBACK' | 'WATCH';
  }
): DailyReviewCandidate {
  return {
    ticker,
    signal: 'breakout',
    close: 100,
    entry: 101,
    stop: 97,
    shares: 10,
    rReward: 2,
    name: ticker,
    sector: 'Tech',
    recommendation: {
      verdict,
      reasonsShort: [],
      reasonsDetailed: [],
      risk: { entry: 101, riskAmount: 100, riskPct: 0.01, positionSize: 1000, shares: 10 },
      costs: { commissionEstimate: 1, fxEstimate: 0, slippageEstimate: 1, totalCost: 2 },
      checklist: [],
      education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
    },
    decisionSummary: {
      symbol: ticker,
      action,
      conviction: 'high',
      technicalLabel: 'strong',
      fundamentalsLabel: 'strong',
      valuationLabel: 'fair',
      catalystLabel: 'active',
      whyNow: 'Why now.',
      whatToDo: 'What to do.',
      mainRisk: 'Risk.',
      tradePlan: {},
      valuationContext: { method: 'not_available' },
      drivers: { positives: [], negatives: [], warnings: [] },
    },
  };
}

describe('filterDailyReviewCandidates', () => {
  it('filters by verdict and decision action', () => {
    const candidates = [
      buildCandidate('BUY-REC', { verdict: 'RECOMMENDED', action: 'BUY_NOW' }),
      buildCandidate('PULL-REC', { verdict: 'RECOMMENDED', action: 'BUY_ON_PULLBACK' }),
      buildCandidate('WATCH-NR', { verdict: 'NOT_RECOMMENDED', action: 'WATCH' }),
    ];

    expect(
      filterDailyReviewCandidates(candidates, { recommendedOnly: true, actionFilter: 'all' }).map((candidate) => candidate.ticker)
    ).toEqual(['BUY-REC', 'PULL-REC']);
    expect(
      filterDailyReviewCandidates(candidates, { recommendedOnly: false, actionFilter: 'WATCH' }).map((candidate) => candidate.ticker)
    ).toEqual(['WATCH-NR']);
  });
});
