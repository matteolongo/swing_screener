import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';
import type { Recommendation, WorkflowStatus } from '@/types/recommendation';

const recommendation = (workflowStatus: WorkflowStatus): Pick<Recommendation, 'workflowStatus' | 'nextStep'> => ({
  workflowStatus,
  nextStep: { code: workflowStatus === 'ready' ? 'review_order' : 'observe' },
});

describe('RecommendationBadge', () => {
  it.each([
    ['ready', 'recommendation.workflow.status.ready'],
    ['waiting_trigger', 'recommendation.workflow.status.waitingTrigger'],
    ['needs_review', 'recommendation.workflow.status.needsReview'],
    ['no_setup', 'recommendation.workflow.status.noSetup'],
  ] as const)('shows the workflow label for %s', (status, labelKey) => {
    render(<RecommendationBadge recommendation={recommendation(status)} />);

    expect(screen.getByText(t(labelKey))).toBeInTheDocument();
  });

  it('falls back to needs review when no recommendation is provided', () => {
    render(<RecommendationBadge />);

    expect(screen.getByText(t('recommendation.workflow.status.needsReview'))).toBeInTheDocument();
    expect(screen.queryByText(t('recommendation.workflow.status.ready'))).not.toBeInTheDocument();
  });

  it('does not show explanation text by default', () => {
    render(<RecommendationBadge recommendation={recommendation('ready')} />);

    expect(screen.queryByText(t('recommendation.setupQualityExplanation'))).not.toBeInTheDocument();
  });

  it('shows explanation text when showExplanation prop is true', () => {
    render(<RecommendationBadge recommendation={recommendation('ready')} showExplanation />);

    expect(screen.getByText(t('recommendation.setupQualityExplanation'))).toBeInTheDocument();
  });
});
