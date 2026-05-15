import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BeginnerDecisionHeader from '@/components/domain/workspace/BeginnerDecisionHeader';
import type { ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';

function buildCandidate(overrides: Partial<ScreenerCandidate> = {}): ScreenerCandidate {
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
    ...overrides,
  };
}

function buildBuyNowCandidate(): ScreenerCandidate {
  return buildCandidate({
    decisionSummary: {
      symbol: 'AAPL',
      action: 'BUY_NOW',
      conviction: 'high',
      technicalLabel: 'strong',
      fundamentalsLabel: 'strong',
      valuationLabel: 'fair',
      catalystLabel: 'active',
      whyNow: 'Setup timing is ready.',
      whatToDo: 'Use the current trade plan.',
      mainRisk: 'Valuation risk remains.',
      tradePlan: { entry: 180, stop: 171, target: 198, rr: 2 },
      valuationContext: { method: 'not_available' },
      drivers: { positives: [], negatives: [], warnings: [] },
      explanation: {
        summaryLine: 'Setup is ready to act on.',
        whyItQualified: [],
        whyNow: [],
        mainRisks: ['Market correction risk'],
        whatInvalidatesIt: ['Close below 171'],
        nextBestAction: 'Prepare order',
        confidenceNotes: [],
      },
    },
  });
}

function buildWatchCandidate(): ScreenerCandidate {
  return buildCandidate({
    decisionSummary: {
      symbol: 'MSFT',
      action: 'WATCH',
      conviction: 'medium',
      technicalLabel: 'neutral',
      fundamentalsLabel: 'strong',
      valuationLabel: 'fair',
      catalystLabel: 'neutral',
      whyNow: 'Setup not ready yet.',
      whatToDo: 'Keep on watchlist.',
      mainRisk: 'Momentum fading.',
      tradePlan: {},
      valuationContext: { method: 'not_available' },
      drivers: { positives: [], negatives: [], warnings: [] },
    },
    ticker: 'MSFT',
  });
}

describe('BeginnerDecisionHeader', () => {
  it('shows the question text', () => {
    const candidate = buildBuyNowCandidate();
    renderWithProviders(
      <BeginnerDecisionHeader candidate={candidate} onAction={vi.fn()} />
    );

    expect(screen.getByText(t('analysis.beginnerHeader.question'))).toBeInTheDocument();
  });

  it('shows ready answer text for a BUY_NOW candidate', () => {
    const candidate = buildBuyNowCandidate();
    renderWithProviders(
      <BeginnerDecisionHeader candidate={candidate} onAction={vi.fn()} />
    );

    expect(screen.getByText(t('analysis.beginnerHeader.answer.ready'))).toBeInTheDocument();
  });

  it('shows watch only answer text for a WATCH candidate', () => {
    const candidate = buildWatchCandidate();
    renderWithProviders(
      <BeginnerDecisionHeader candidate={candidate} onAction={vi.fn()} />
    );

    expect(screen.getByText(t('analysis.beginnerHeader.answer.watchOnly'))).toBeInTheDocument();
  });

  it('shows main risk when decision.mainRisk is defined', () => {
    const candidate = buildBuyNowCandidate();
    renderWithProviders(
      <BeginnerDecisionHeader candidate={candidate} onAction={vi.fn()} />
    );

    expect(screen.getByText(t('analysis.beginnerHeader.mainRisk'))).toBeInTheDocument();
    expect(screen.getByText('Market correction risk')).toBeInTheDocument();
  });

  it('shows invalidation when decision.invalidation is defined', () => {
    const candidate = buildBuyNowCandidate();
    renderWithProviders(
      <BeginnerDecisionHeader candidate={candidate} onAction={vi.fn()} />
    );

    expect(screen.getByText(t('analysis.beginnerHeader.invalidation'))).toBeInTheDocument();
    expect(screen.getByText('Close below 171')).toBeInTheDocument();
  });

  it('calls onAction with the correct nextStepKind when action button is clicked', async () => {
    const onAction = vi.fn();
    const candidate = buildBuyNowCandidate();
    const { user } = renderWithProviders(
      <BeginnerDecisionHeader candidate={candidate} onAction={onAction} />
    );

    await user.click(
      screen.getByRole('button', { name: t('analysis.beginnerHeader.action.prepare_order') })
    );

    expect(onAction).toHaveBeenCalledWith('prepare_order');
  });
});
