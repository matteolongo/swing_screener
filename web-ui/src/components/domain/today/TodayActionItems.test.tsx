import { describe, expect, it } from 'vitest';
import { CandidateItem } from './TodayActionItems';
import { renderWithProviders, screen } from '@/test/utils';
import { messagesEn } from '@/i18n/messages.en';
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
  it('shows the action as the primary badge and re-enter as a secondary flag', () => {
    const item = makeCandidate({
      sameSymbol: { mode: 'RE_ENTRY' } as DailyReviewCandidate['sameSymbol'],
    });
    renderWithProviders(<CandidateItem item={item} onClick={() => {}} />);

    // Action is still shown (the thing you can act on)...
    expect(
      screen.getByText(messagesEn.workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback),
    ).toBeInTheDocument();
    // ...and re-enter is an additional flag, not a replacement.
    expect(screen.getByText(messagesEn.todayPage.actionList.reEnter)).toBeInTheDocument();
  });

  it('shows only the action badge (no flag) for a plain new entry', () => {
    const item = makeCandidate();
    renderWithProviders(<CandidateItem item={item} onClick={() => {}} />);

    expect(
      screen.getByText(messagesEn.workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback),
    ).toBeInTheDocument();
    expect(screen.queryByText(messagesEn.todayPage.actionList.reEnter)).not.toBeInTheDocument();
  });
});
