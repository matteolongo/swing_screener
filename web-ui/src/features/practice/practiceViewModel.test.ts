import { describe, expect, it } from 'vitest';
import { buildExecutionReadback, buildPracticeCards } from './practiceViewModel';
import type { DailyReviewCandidate } from '@/features/dailyReview/types';
import type { DecisionAction } from '@/features/screener/types';
import type { RiskConfig } from '@/types/config';

const risk: RiskConfig = {
  accountSize: 10000,
  riskPct: 0.01,
  maxPositionPct: 0.5,
  minShares: 1,
  kAtr: 2,
  minRr: 2,
  maxFeeRiskPct: 0.2,
};

function makeCandidate(action: DecisionAction): DailyReviewCandidate {
  return {
    ticker: 'AAPL',
    currency: 'USD',
    signal: 'breakout',
    close: 100,
    entry: 101,
    stop: 96,
    shares: 20,
    rReward: 2.5,
    name: 'Apple',
    sector: 'Tech',
    recommendation: {
      verdict: 'RECOMMENDED',
      reasonsShort: ['Trend is strong'],
      reasonsDetailed: [],
      risk: {
        entry: 101,
        stop: 96,
        target: 113.5,
        rr: 2.5,
        riskAmount: 100,
        riskPct: 0.01,
        positionSize: 2020,
        shares: 20,
      },
      costs: {
        commissionEstimate: 2,
        fxEstimate: 0,
        slippageEstimate: 0,
        totalCost: 2,
        feeToRiskPct: 0.02,
      },
      checklist: [
        { gateName: 'Risk', passed: true, explanation: 'Risk is within limits' },
        { gateName: 'Invalidation', passed: false, explanation: 'Needs a clearer invalidation' },
      ],
      education: {
        commonBiasWarning: 'Do not chase after the breakout bar.',
        whatToLearn: 'Great setups still need a clean stop.',
        whatWouldMakeValid: ['Wait for a tighter stop zone'],
      },
      thesis: {
        ticker: 'AAPL',
        strategy: 'momentum',
        entryType: 'breakout',
        trendStatus: 'strong',
        relativeStrength: 'positive',
        regimeAlignment: true,
        volatilityState: 'normal',
        riskReward: 2.5,
        setupQualityScore: 80,
        setupQualityTier: 'HIGH_QUALITY',
        institutionalSignal: true,
        priceActionQuality: 'clean',
        safetyLabel: 'REQUIRES_DISCIPLINE',
        personality: {
          trendStrength: 4,
          volatilityRating: 2,
          conviction: 4,
          complexity: 'moderate',
        },
        explanation: {
          whyQualified: ['Trend', 'Volume'],
          whatCouldGoWrong: ['Breakout failure'],
          setupType: 'Breakout',
          keyInsight: 'Institutional accumulation is visible.',
        },
        invalidationRules: [
          { ruleId: '1', condition: 'Exit if price loses 96.00 on closing basis.' },
        ],
      },
    },
    decisionSummary: {
      symbol: 'AAPL',
      action,
      conviction: 'high',
      technicalLabel: 'strong',
      fundamentalsLabel: 'strong',
      valuationLabel: 'fair',
      catalystLabel: 'active',
      whyNow: 'Fresh breakout',
      whatToDo: 'Enter on confirmation',
      mainRisk: 'Breakout could fail',
      tradePlan: {
        entry: 101,
        stop: 96,
        target: 113.5,
        rr: 2.5,
      },
      valuationContext: {
        method: 'not_available',
      },
      drivers: {
        positives: ['Trend alignment is strong'],
        negatives: ['Breakout gap may need a tighter stop'],
        warnings: ['Do not chase extended price'],
      },
      explanation: {
        summaryLine: 'Momentum is strong, but the entry still needs a disciplined stop.',
        whyItQualified: ['trend'],
        whyNow: ['breakout'],
        mainRisks: ['gap risk'],
        whatInvalidatesIt: ['loss of support'],
        nextBestAction: 'Wait for confirmation',
        confidenceNotes: ['risk gate is still important'],
      },
    },
  };
}

describe('practiceViewModel', () => {
  it('maps decision actions to verdict banners', () => {
    const tradeNow = buildPracticeCards([makeCandidate('BUY_NOW')])[0];
    const wait = buildPracticeCards([makeCandidate('WAIT_FOR_BREAKOUT')])[0];
    const avoid = buildPracticeCards([makeCandidate('AVOID')])[0];

    expect(tradeNow.verdictBanner).toBe('TRADE_NOW');
    expect(wait.verdictBanner).toBe('WAIT');
    expect(avoid.verdictBanner).toBe('AVOID');
  });

  it('extracts evidence cards and learning notes', () => {
    const card = buildPracticeCards([makeCandidate('BUY_NOW')])[0];

    expect(card.evidenceCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'trend', status: 'positive' }),
        expect.objectContaining({ label: 'risk', status: 'negative' }),
      ]),
    );
    expect(card.whatToLearn.commonMistake).toContain('Do not chase');
    expect(card.whatToLearn.ruleToRemember).toContain('Exit if price loses');
  });

  it('builds execution readback values from recommendation risk and checklist', () => {
    const readback = buildExecutionReadback(makeCandidate('BUY_NOW'), risk);

    expect(readback.maxLoss).toBe(100);
    expect(readback.maxLossPercent).toBe(1);
    expect(readback.checklist).toHaveLength(3);
    expect(readback.thesisSummary).toContain('Momentum is strong');
  });

  it('falls back gracefully when optional fields are missing', () => {
    const candidate = makeCandidate('WATCH');
    candidate.recommendation = undefined;
    candidate.decisionSummary = {
      ...candidate.decisionSummary!,
      explanation: undefined,
    };

    const card = buildPracticeCards([candidate])[0];
    const readback = buildExecutionReadback(candidate, risk);

    expect(card.whatToLearn.keyIdea).toBe('Learn only the concepts relevant to this current setup.');
    expect(readback.checklist).toHaveLength(1);
    expect(readback.invalidationCondition).toContain('Breakout could fail');
  });
});
