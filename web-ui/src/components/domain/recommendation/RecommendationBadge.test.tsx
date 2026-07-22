import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';
import type { DecisionGateState } from '@/types/recommendation';

const waitingGates: DecisionGateState = {
  setup: { status: 'PASS', explanation: 'Setup qualifies.' },
  trigger: { status: 'WAIT', explanation: 'Waiting for pullback.' },
  plan: { status: 'PASS', explanation: 'Plan reconciles.' },
  portfolio: { status: 'UNKNOWN', explanation: 'Checked during order review.' },
  readyToOrder: false,
};

describe('RecommendationBadge', () => {
  it('shows ready-for-review label for a legacy RECOMMENDED verdict', () => {
    render(<RecommendationBadge verdict="RECOMMENDED" />);
    expect(screen.getByText(t('recommendation.readiness.READY_FOR_REVIEW'))).toBeInTheDocument();
  });

  it('shows not-ready label for a legacy NOT_RECOMMENDED verdict', () => {
    render(<RecommendationBadge verdict="NOT_RECOMMENDED" />);
    expect(screen.getByText(t('recommendation.readiness.NOT_READY'))).toBeInTheDocument();
  });

  it('shows unknown-readiness label for UNKNOWN verdict', () => {
    render(<RecommendationBadge verdict="UNKNOWN" />);
    expect(screen.getByText(t('recommendation.readiness.UNKNOWN'))).toBeInTheDocument();
  });

  it('shows unknown-readiness label when no verdict is provided', () => {
    render(<RecommendationBadge />);
    expect(screen.getByText(t('recommendation.readiness.UNKNOWN'))).toBeInTheDocument();
  });

  it('shows waiting-for-trigger when a qualified conditional setup is not executable', () => {
    render(
      <RecommendationBadge
        verdict="NOT_RECOMMENDED"
        decisionGates={waitingGates}
      />,
    );
    expect(screen.getByText(t('recommendation.readiness.WAITING_FOR_TRIGGER'))).toBeInTheDocument();
    expect(screen.queryByText(t('recommendation.verdict.NOT_RECOMMENDED'))).not.toBeInTheDocument();
  });

  it('does not show explanation text by default', () => {
    render(<RecommendationBadge verdict="RECOMMENDED" />);
    expect(screen.queryByText(t('recommendation.setupQualityExplanation'))).not.toBeInTheDocument();
  });

  it('shows explanation text when showExplanation prop is true', () => {
    render(<RecommendationBadge verdict="RECOMMENDED" showExplanation />);
    expect(screen.getByText(t('recommendation.setupQualityExplanation'))).toBeInTheDocument();
  });
});
