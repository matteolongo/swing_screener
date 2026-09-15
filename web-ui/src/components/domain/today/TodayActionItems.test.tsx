import { describe, expect, it } from 'vitest';
import { OpenPositionItem, CandidateItem } from './TodayActionItems';
import { renderWithProviders, screen } from '@/test/utils';
import { t } from '@/i18n/t';
import type { DailyReviewCandidate } from '@/features/dailyReview/types';

function makeCandidate(overrides: Partial<DailyReviewCandidate> = {}): DailyReviewCandidate {
  return {
    ticker: 'BESI.AS',
    signal: 'MOMENTUM',
    close: 289.1,
    entry: 289.1,
    stop: 259.01,
    shares: 1,
    rReward: 2,
    name: 'BE Semiconductor Industries N.V.',
    sector: 'Technology',
    confidence: 72,
    decisionSummary: { action: 'BUY_ON_PULLBACK' } as DailyReviewCandidate['decisionSummary'],
    ...overrides,
  };
}

describe('CandidateItem badges', () => {
  it('shows the canonical next step as the primary badge and re-enter as a secondary flag', () => {
    const item = makeCandidate({
      recommendation: { workflowStatus: 'no_setup', nextStep: { code: 'observe' } } as DailyReviewCandidate['recommendation'],
      sameSymbol: { mode: 'RE_ENTRY' } as DailyReviewCandidate['sameSymbol'],
    });
    renderWithProviders(<CandidateItem item={item} onClick={() => {}} />);

    // Action is still shown (the thing you can act on)...
    expect(
      screen.getByText(t('recommendation.workflow.nextStep.observe')),
    ).toBeInTheDocument();
    // ...and re-enter is an additional flag, not a replacement.
    expect(screen.getByText(t('todayPage.actionList.reEnter'))).toBeInTheDocument();
  });

  it('does not promote BUY_ON_PULLBACK when the canonical workflow has no setup', () => {
    const item = makeCandidate({
      recommendation: { workflowStatus: 'no_setup', nextStep: { code: 'observe' } } as DailyReviewCandidate['recommendation'],
    });
    renderWithProviders(<CandidateItem item={item} onClick={() => {}} />);

    expect(screen.getByText(t('recommendation.workflow.nextStep.observe'))).toBeInTheDocument();
    expect(screen.queryByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback'))).not.toBeInTheDocument();
  });
});

describe('row actions', () => {
  it('renders selection and trim as sibling native buttons in a semantic group', () => {
    renderWithProviders(
      <OpenPositionItem
        item={{ ticker: 'LRCX', positionId: 'POS-1', rNow: 2.1, daysOpen: 4, pnlPercent: 8 } as never}
        trimSuggestion={{ rThreshold: 2, rNow: 2.1 }}
        onClick={() => {}}
        onTrim={() => {}}
      />,
    );

    const group = screen.getByRole('group', { name: 'LRCX' });
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(group.querySelector('button button')).toBeNull();
  });
});
