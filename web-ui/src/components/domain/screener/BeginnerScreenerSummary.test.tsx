import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import BeginnerScreenerSummary from './BeginnerScreenerSummary';
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
              summaryLine || mainRisks.length > 0
                ? {
                    summaryLine: summaryLine ?? '',
                    whyItQualified: [],
                    whyNow: [],
                    mainRisks,
                    whatInvalidatesIt: [],
                    nextBestAction: '',
                    confidenceNotes: [],
                  }
                : undefined,
          }
        : undefined,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BeginnerScreenerSummary', () => {
  it('shows best candidate section with ticker and reason when candidates exist', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'up',
    });

    renderWithProviders(
      <BeginnerScreenerSummary
        candidates={[candidate]}
        onReviewCandidate={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.beginnerSummary.bestCandidate'))).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('shows order readiness chip with correct text for ready readiness', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'up',
    });

    renderWithProviders(
      <BeginnerScreenerSummary
        candidates={[candidate]}
        onReviewCandidate={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.beginnerSummary.readiness.ready'))).toBeInTheDocument();
  });

  it('shows main risk when decision.mainRisk is defined', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      mainRisks: ['Valuation stretched.'],
    });

    renderWithProviders(
      <BeginnerScreenerSummary
        candidates={[candidate]}
        onReviewCandidate={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.beginnerSummary.mainRisk'))).toBeInTheDocument();
    expect(screen.getByText('Valuation stretched.')).toBeInTheDocument();
  });

  it('calls onReviewCandidate with correct ticker when CTA is clicked', async () => {
    const onReviewCandidate = vi.fn();
    const candidate = makeCandidate('MSFT', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
    });

    const { user } = renderWithProviders(
      <BeginnerScreenerSummary
        candidates={[candidate]}
        onReviewCandidate={onReviewCandidate}
      />
    );

    await user.click(screen.getByRole('button', { name: t('screener.beginnerSummary.reviewCandidate') }));

    expect(onReviewCandidate).toHaveBeenCalledWith('MSFT');
  });

  it('shows no-candidates message when candidates is empty', () => {
    renderWithProviders(
      <BeginnerScreenerSummary
        candidates={[]}
        onReviewCandidate={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.beginnerSummary.noCandidates'))).toBeInTheDocument();
  });

  it('shows watchOnly readiness chip when best candidate has WATCH action', () => {
    const candidate = makeCandidate('TSLA', {
      action: 'WATCH',
      verdict: 'RECOMMENDED',
    });

    renderWithProviders(
      <BeginnerScreenerSummary
        candidates={[candidate]}
        onReviewCandidate={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.beginnerSummary.readiness.watchOnly'))).toBeInTheDocument();
  });
});
