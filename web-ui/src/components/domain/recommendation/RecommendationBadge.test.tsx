import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';

describe('RecommendationBadge', () => {
  it('shows beginner-friendly "Setup passes" label for RECOMMENDED verdict', () => {
    render(<RecommendationBadge verdict="RECOMMENDED" />);
    expect(screen.getByText(t('recommendation.verdict.RECOMMENDED'))).toBeInTheDocument();
  });

  it('shows beginner-friendly "Setup fails" label for NOT_RECOMMENDED verdict', () => {
    render(<RecommendationBadge verdict="NOT_RECOMMENDED" />);
    expect(screen.getByText(t('recommendation.verdict.NOT_RECOMMENDED'))).toBeInTheDocument();
  });

  it('shows "Setup incomplete" label for UNKNOWN verdict', () => {
    render(<RecommendationBadge verdict="UNKNOWN" />);
    expect(screen.getByText(t('recommendation.verdict.UNKNOWN'))).toBeInTheDocument();
  });

  it('shows "Setup incomplete" label when no verdict is provided', () => {
    render(<RecommendationBadge />);
    expect(screen.getByText(t('recommendation.verdict.UNKNOWN'))).toBeInTheDocument();
  });

  it('shows "Setup incomplete" label when NOT_RECOMMENDED verdict is due to completeness only', () => {
    render(
      <RecommendationBadge
        verdict="NOT_RECOMMENDED"
        reasonsDetailed={[
          { code: 'STOP_MISSING', severity: 'block', message: 'Stop is missing', metrics: {} },
        ]}
      />,
    );
    expect(screen.getByText(t('recommendation.verdict.INCOMPLETE'))).toBeInTheDocument();
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
