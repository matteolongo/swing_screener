import { describe, expect, it } from 'vitest';

import {
  toOrderReadiness,
  toSetupQuality,
  toBeginnerDecision,
  plainActionLabel,
  pickBestBeginnerCandidate,
} from '@/features/screener/beginnerDecision';
import type { ScreenerCandidate, DecisionAction } from '@/features/screener/types';
import type { Recommendation } from '@/types/recommendation';

// ── Test fixtures ────────────────────────────────────────────────────────────

function makeRecommendation(verdict: 'RECOMMENDED' | 'NOT_RECOMMENDED'): Recommendation {
  return {
    verdict,
    reasonsShort: [],
    reasonsDetailed: [],
    risk: { entry: 100, riskAmount: 5, riskPct: 0.05, positionSize: 1000, shares: 10 },
    costs: { commissionEstimate: 1, fxEstimate: 0, slippageEstimate: 1, totalCost: 2 },
    checklist: [],
    education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
  };
}

function makeCandidate(
  ticker: string,
  {
    action,
    verdict,
    warnings = [],
    weeklyTrend,
    withDecisionSummary = true,
    summaryLine,
    whatToDo,
    whyNow,
    mainRisks = [],
    whatInvalidatesIt = [],
    mainRisk,
  }: {
    action?: DecisionAction;
    verdict?: 'RECOMMENDED' | 'NOT_RECOMMENDED';
    warnings?: string[];
    weeklyTrend?: 'up' | 'down' | 'neutral';
    withDecisionSummary?: boolean;
    summaryLine?: string;
    whatToDo?: string;
    whyNow?: string;
    mainRisks?: string[];
    whatInvalidatesIt?: string[];
    mainRisk?: string;
  } = {}
): ScreenerCandidate {
  return {
    ticker,
    currency: 'USD',
    close: 150,
    sma20: 148,
    sma50: 145,
    sma200: 140,
    atr: 2,
    momentum6m: 0.2,
    momentum12m: 0.3,
    relStrength: 1.1,
    score: 0.8,
    confidence: 75,
    rank: 1,
    recommendation: verdict ? makeRecommendation(verdict) : undefined,
    weeklyTrend,
    decisionSummary:
      withDecisionSummary && action
        ? {
            symbol: ticker,
            action,
            conviction: 'high',
            technicalLabel: 'strong',
            fundamentalsLabel: 'strong',
            valuationLabel: 'fair',
            catalystLabel: 'active',
            whyNow: whyNow ?? 'Why now text.',
            whatToDo: whatToDo ?? 'What to do text.',
            mainRisk: mainRisk ?? 'Main risk text.',
            tradePlan: { entry: 150, stop: 145, target: 165, rr: 3 },
            valuationContext: { method: 'not_available' },
            drivers: {
              positives: ['Technical setup is ready.'],
              negatives: [],
              warnings,
            },
            explanation:
              summaryLine || mainRisks.length > 0 || whatInvalidatesIt.length > 0
                ? {
                    summaryLine: summaryLine ?? '',
                    whyItQualified: [],
                    whyNow: [],
                    mainRisks,
                    whatInvalidatesIt,
                    nextBestAction: '',
                    confidenceNotes: [],
                  }
                : undefined,
            catalystSummary: null,
            catalystSources: [],
          }
        : undefined,
  };
}

// ── toOrderReadiness ─────────────────────────────────────────────────────────

describe('toOrderReadiness', () => {
  it('maps BUY_NOW to ready', () => {
    const candidate = makeCandidate('AAPL', { action: 'BUY_NOW', verdict: 'RECOMMENDED' });
    expect(toOrderReadiness(candidate)).toBe('ready');
  });

  it('maps BUY_ON_PULLBACK to wait_for_price', () => {
    const candidate = makeCandidate('AAPL', { action: 'BUY_ON_PULLBACK', verdict: 'RECOMMENDED' });
    expect(toOrderReadiness(candidate)).toBe('wait_for_price');
  });

  it('maps WAIT_FOR_BREAKOUT to wait_for_price', () => {
    const candidate = makeCandidate('AAPL', { action: 'WAIT_FOR_BREAKOUT', verdict: 'RECOMMENDED' });
    expect(toOrderReadiness(candidate)).toBe('wait_for_price');
  });

  it('maps WATCH to watch_only', () => {
    const candidate = makeCandidate('AAPL', { action: 'WATCH', verdict: 'RECOMMENDED' });
    expect(toOrderReadiness(candidate)).toBe('watch_only');
  });

  it('maps AVOID to avoid', () => {
    const candidate = makeCandidate('AAPL', { action: 'AVOID' });
    expect(toOrderReadiness(candidate)).toBe('avoid');
  });

  it('maps MANAGE_ONLY to manage_existing', () => {
    const candidate = makeCandidate('AAPL', { action: 'MANAGE_ONLY' });
    expect(toOrderReadiness(candidate)).toBe('manage_existing');
  });

  it('returns incomplete when no decisionSummary', () => {
    const candidate = makeCandidate('AAPL', { withDecisionSummary: false });
    expect(toOrderReadiness(candidate)).toBe('incomplete');
  });

  it('maps TACTICAL_ONLY with warnings to incomplete', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'TACTICAL_ONLY',
      verdict: 'RECOMMENDED',
      warnings: ['Fundamental coverage is partial.'],
    });
    expect(toOrderReadiness(candidate)).toBe('incomplete');
  });

  it('maps TACTICAL_ONLY without warnings and with recommendation to watch_only', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'TACTICAL_ONLY',
      verdict: 'RECOMMENDED',
      warnings: [],
    });
    expect(toOrderReadiness(candidate)).toBe('watch_only');
  });

  it('maps TACTICAL_ONLY without recommendation to incomplete', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'TACTICAL_ONLY',
      warnings: [],
    });
    expect(toOrderReadiness(candidate)).toBe('incomplete');
  });
});

// ── toSetupQuality ───────────────────────────────────────────────────────────

describe('toSetupQuality', () => {
  it('returns pass for RECOMMENDED, no warnings, weekly up', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'up',
    });
    expect(toSetupQuality(candidate)).toBe('pass');
  });

  it('returns caution for RECOMMENDED with warnings', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      warnings: ['Fundamental data quality is limited.'],
    });
    expect(toSetupQuality(candidate)).toBe('caution');
  });

  it('returns caution for RECOMMENDED with weeklyTrend down', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'down',
    });
    expect(toSetupQuality(candidate)).toBe('caution');
  });

  it('returns fail for NOT_RECOMMENDED', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'NOT_RECOMMENDED',
    });
    expect(toSetupQuality(candidate)).toBe('fail');
  });

  it('returns incomplete when recommendation is missing', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      withDecisionSummary: true,
    });
    expect(toSetupQuality(candidate)).toBe('incomplete');
  });

  it('returns incomplete when decisionSummary is missing', () => {
    const candidate = makeCandidate('AAPL', { withDecisionSummary: false });
    expect(toSetupQuality(candidate)).toBe('incomplete');
  });

  it('returns pass for RECOMMENDED + WATCH action, no warnings, weekly neutral', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'WATCH',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'neutral',
    });
    expect(toSetupQuality(candidate)).toBe('pass');
  });
});

// ── toBeginnerDecision ───────────────────────────────────────────────────────

describe('toBeginnerDecision', () => {
  it('returns ready + pass for BUY_NOW + RECOMMENDED + no warnings + weekly up', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'up',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.ticker).toBe('AAPL');
    expect(decision.orderReadiness).toBe('ready');
    expect(decision.setupQuality).toBe('pass');
    expect(decision.nextStepKind).toBe('prepare_order');
    expect(decision.nextStepLabel).toBe('Prepare order');
    expect(decision.suggestedAction).toBe('BUY_NOW');
  });

  it('returns ready readiness with caution quality for BUY_NOW + RECOMMENDED + warnings', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      warnings: ['Fundamental snapshot is stale.'],
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.orderReadiness).toBe('ready');
    expect(decision.setupQuality).toBe('caution');
  });

  it('returns watch_only for RECOMMENDED + WATCH action', () => {
    const candidate = makeCandidate('MSFT', {
      action: 'WATCH',
      verdict: 'RECOMMENDED',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.orderReadiness).toBe('watch_only');
    expect(['pass', 'caution']).toContain(decision.setupQuality);
    expect(decision.nextStepKind).toBe('watch');
  });

  it('returns avoid readiness for AVOID action', () => {
    const candidate = makeCandidate('XYZ', { action: 'AVOID' });
    const decision = toBeginnerDecision(candidate);

    expect(decision.orderReadiness).toBe('avoid');
    expect(decision.nextStepKind).toBe('avoid');
    expect(decision.nextStepLabel).toBe('Skip');
  });

  it('returns manage_existing readiness for MANAGE_ONLY', () => {
    const candidate = makeCandidate('TSLA', {
      action: 'MANAGE_ONLY',
      verdict: 'RECOMMENDED',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.orderReadiness).toBe('manage_existing');
    expect(decision.nextStepKind).toBe('update_stop');
    expect(decision.nextStepLabel).toBe('Manage position');
  });

  it('returns incomplete for missing decisionSummary', () => {
    const candidate = makeCandidate('NVDA', { withDecisionSummary: false });
    const decision = toBeginnerDecision(candidate);

    expect(decision.orderReadiness).toBe('incomplete');
    expect(decision.setupQuality).toBe('incomplete');
    expect(decision.nextStepKind).toBe('review_candidate');
    expect(decision.nextStepLabel).toBe('Review candidate');
  });

  it('prefers explanation.summaryLine as plainReason', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      summaryLine: 'Strong technical and fundamental alignment supports a buy.',
      whatToDo: 'Use the current trade plan.',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.plainReason).toBe('Strong technical and fundamental alignment supports a buy.');
  });

  it('falls back to whatToDo when no summaryLine', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      whatToDo: 'Use the current trade plan.',
      whyNow: 'Timing is right.',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.plainReason).toBe('Use the current trade plan.');
  });

  it('falls back to whyNow when no summaryLine or whatToDo', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      whatToDo: '',
      whyNow: 'Timing is right.',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.plainReason).toBe('Timing is right.');
  });

  it('uses explanation.mainRisks[0] as mainRisk when available', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      mainRisks: ['Valuation stretched.', 'Momentum fading.'],
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.mainRisk).toBe('Valuation stretched.');
  });

  it('falls back to decisionSummary.mainRisk when no explanation risks', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      mainRisk: 'Valuation looks demanding.',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.mainRisk).toBe('Valuation looks demanding.');
  });

  it('falls back to driver warning when no mainRisk in summary', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      warnings: ['Fundamental snapshot is stale.'],
      mainRisk: '',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.mainRisk).toBe('Fundamental snapshot is stale.');
  });

  it('uses weeklyTrend down as mainRisk fallback', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'down',
      mainRisk: '',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.mainRisk).toBe('Weekly trend is down — consider waiting for trend to recover.');
  });

  it('uses explanation.whatInvalidatesIt[0] as invalidation', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      whatInvalidatesIt: ['Price closes below the 50-day MA.', 'Volume dries up.'],
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.invalidation).toBe('Price closes below the 50-day MA.');
  });

  it('formats long stop decimal in invalidation text', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      whatInvalidatesIt: ['Price closing below the stop at 396.9259 invalidates the setup.'],
    });
    candidate.decisionSummary!.tradePlan = { entry: 400, stop: 396.9259, target: 420, rr: 3 };
    const decision = toBeginnerDecision(candidate);

    expect(decision.invalidation).toContain('$396.93');
    expect(decision.invalidation).not.toContain('396.9259');
  });

  it('has no invalidation when whatInvalidatesIt is empty', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
    });
    const decision = toBeginnerDecision(candidate);

    expect(decision.invalidation).toBeUndefined();
  });

  it('headline is not empty for any action', () => {
    const actions: DecisionAction[] = [
      'BUY_NOW',
      'BUY_ON_PULLBACK',
      'WAIT_FOR_BREAKOUT',
      'WATCH',
      'TACTICAL_ONLY',
      'AVOID',
      'MANAGE_ONLY',
    ];
    for (const action of actions) {
      const candidate = makeCandidate('TEST', { action });
      const decision = toBeginnerDecision(candidate);
      expect(decision.headline.length).toBeGreaterThan(0);
    }
    // Also test missing decisionSummary
    const noSummary = makeCandidate('TEST', { withDecisionSummary: false });
    const decision = toBeginnerDecision(noSummary);
    expect(decision.headline.length).toBeGreaterThan(0);
  });
});

// ── plainActionLabel ─────────────────────────────────────────────────────────

describe('plainActionLabel', () => {
  const cases: Array<[DecisionAction, string]> = [
    ['BUY_NOW', 'Buy now'],
    ['BUY_ON_PULLBACK', 'Buy on pullback'],
    ['WAIT_FOR_BREAKOUT', 'Wait for breakout'],
    ['WATCH', 'Watch'],
    ['TACTICAL_ONLY', 'Tactical only'],
    ['AVOID', 'Avoid'],
    ['MANAGE_ONLY', 'Manage existing'],
  ];

  it.each(cases)('returns correct label for %s', (action, expected) => {
    expect(plainActionLabel(action)).toBe(expected);
  });
});

// ── pickBestBeginnerCandidate ────────────────────────────────────────────────

describe('pickBestBeginnerCandidate', () => {
  it('returns undefined for empty array', () => {
    expect(pickBestBeginnerCandidate([])).toBeUndefined();
  });

  it('returns the first non-avoid/non-manage candidate after prioritization', () => {
    const avoid = makeCandidate('SKIP', { action: 'AVOID' });
    const manage = makeCandidate('HOLD', { action: 'MANAGE_ONLY' });
    const buy = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
    });
    const watch = makeCandidate('MSFT', { action: 'WATCH', verdict: 'RECOMMENDED' });

    // prioritizeCandidates orders BUY_NOW > WATCH > MANAGE_ONLY > AVOID
    const result = pickBestBeginnerCandidate([avoid, manage, buy, watch]);
    expect(result?.ticker).toBe('AAPL');
  });

  it('returns first candidate overall when all are avoid or manage_existing', () => {
    const avoid = makeCandidate('SKIP', { action: 'AVOID' });
    const manage = makeCandidate('HOLD', { action: 'MANAGE_ONLY' });

    const result = pickBestBeginnerCandidate([avoid, manage]);
    // prioritizeCandidates: MANAGE_ONLY (1) > AVOID (0), so first is HOLD
    expect(result?.ticker).toBe('HOLD');
  });

  it('returns the single candidate when only one exists', () => {
    const buy = makeCandidate('AAPL', { action: 'BUY_NOW', verdict: 'RECOMMENDED' });
    expect(pickBestBeginnerCandidate([buy])?.ticker).toBe('AAPL');
  });

  it('skips avoid candidates even when they appear first in input', () => {
    const avoid = makeCandidate('SKIP', { action: 'AVOID' });
    const pullback = makeCandidate('MSFT', { action: 'BUY_ON_PULLBACK', verdict: 'RECOMMENDED' });

    const result = pickBestBeginnerCandidate([avoid, pullback]);
    expect(result?.ticker).toBe('MSFT');
  });
});
