import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import ScreenerCandidateReviewList from './ScreenerCandidateReviewList';
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
            catalystSummary: null,
            catalystSources: [],
          }
        : undefined,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ScreenerCandidateReviewList', () => {
  it('renders ticker and suggested action', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
    });

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText(t('screener.guidedList.action.BUY_NOW'))).toBeInTheDocument();
  });

  it('shows quality badge text for pass quality (BUY_NOW + RECOMMENDED)', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      weeklyTrend: 'up',
    });

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.guidedList.quality.pass'))).toBeInTheDocument();
  });

  it('shows readiness chip for ready readiness', () => {
    const candidate = makeCandidate('AAPL', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
    });

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.guidedList.readiness.ready'))).toBeInTheDocument();
  });

  it('calls onReview with ticker when Review button is clicked', async () => {
    const onReview = vi.fn();
    const candidate = makeCandidate('MSFT', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
    });

    const { user } = renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={onReview}
      />
    );

    await user.click(screen.getByRole('button', { name: t('screener.guidedList.review') }));

    expect(onReview).toHaveBeenCalledWith('MSFT');
  });

  it('calls onReview with ticker when ticker text is clicked', async () => {
    const onReview = vi.fn();
    const candidate = makeCandidate('TSLA', {
      action: 'WATCH',
      verdict: 'RECOMMENDED',
    });

    const { user } = renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={onReview}
      />
    );

    await user.click(screen.getByRole('button', { name: 'TSLA' }));

    expect(onReview).toHaveBeenCalledWith('TSLA');
  });

  it('adds bg-blue-50 to the selected ticker row', () => {
    const candidateA = makeCandidate('AAPL', { action: 'BUY_NOW', verdict: 'RECOMMENDED' });
    const candidateB = makeCandidate('MSFT', { action: 'WATCH', verdict: 'RECOMMENDED' });

    const { container } = renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidateA, candidateB]}
        selectedTicker="AAPL"
        onReview={vi.fn()}
      />
    );

    const rows = container.querySelectorAll('[class*="flex items-start"]');
    const aaplRow = Array.from(rows).find((el) => el.textContent?.includes('AAPL'));
    const msftRow = Array.from(rows).find((el) => el.textContent?.includes('MSFT'));

    expect(aaplRow?.className).toContain('bg-blue-50');
    expect(msftRow?.className).not.toContain('bg-blue-50');
  });

  it('shows empty state when candidates is empty', () => {
    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.guidedList.empty'))).toBeInTheDocument();
  });

  it('suppresses Fails quality badge when orderReadiness is ready (BUY_NOW)', () => {
    const candidate = makeCandidate('AMAT', {
      action: 'BUY_NOW',
      verdict: 'NOT_RECOMMENDED',
    });

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.queryByText(t('screener.guidedList.quality.fail'))).not.toBeInTheDocument();
    expect(screen.getByText(t('screener.guidedList.readiness.ready'))).toBeInTheDocument();
  });

  it('shows Fails quality badge when quality is fail and readiness is not ready (WATCH_ONLY)', () => {
    const candidate = makeCandidate('AMAT', {
      action: 'WATCH',
      verdict: 'NOT_RECOMMENDED',
    });

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.guidedList.quality.fail'))).toBeInTheDocument();
  });

  it('shows Passes quality badge when quality is pass and readiness is ready', () => {
    const candidate = makeCandidate('NVDA', {
      action: 'BUY_NOW',
      verdict: 'RECOMMENDED',
      warnings: [],
      weeklyTrend: 'up',
    });

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText(t('screener.guidedList.quality.pass'))).toBeInTheDocument();
    expect(screen.getByText(t('screener.guidedList.readiness.ready'))).toBeInTheDocument();
  });
});
