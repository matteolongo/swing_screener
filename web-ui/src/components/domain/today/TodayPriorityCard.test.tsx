import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import TodayPriorityCard from './TodayPriorityCard';
import type { TodayPriority } from '@/features/dailyReview/beginnerPriority';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePriority(overrides: Partial<TodayPriority>): TodayPriority {
  return {
    kind: 'no_action',
    headline: 'Nothing urgent today',
    reason: 'All positions are being managed.',
    actionLabel: 'View positions',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TodayPriorityCard', () => {
  it('renders headline and reason', () => {
    const priority = makePriority({
      kind: 'no_action',
      headline: 'Nothing urgent today',
      reason: 'All positions are being managed. Check back after market close.',
      actionLabel: 'View positions',
    });
    renderWithProviders(<TodayPriorityCard priority={priority} onAction={() => {}} />);
    expect(screen.getByText(priority.headline)).toBeInTheDocument();
    expect(screen.getByText(priority.reason)).toBeInTheDocument();
  });

  it('renders risk section when risk is provided', () => {
    const priority = makePriority({
      kind: 'close_position',
      headline: 'AAPL needs to be closed',
      reason: 'Stop hit',
      risk: 'Holding past the exit signal increases loss risk.',
      actionLabel: 'Close position',
    });
    renderWithProviders(<TodayPriorityCard priority={priority} onAction={() => {}} />);
    expect(screen.getByText(t('todayPage.todayPriorityCard.risk'))).toBeInTheDocument();
    expect(screen.getByText(priority.risk!)).toBeInTheDocument();
  });

  it('does not render risk section when risk is absent', () => {
    const priority = makePriority({
      kind: 'no_action',
      headline: 'Nothing urgent today',
      reason: 'All good.',
      actionLabel: 'View positions',
    });
    renderWithProviders(<TodayPriorityCard priority={priority} onAction={() => {}} />);
    expect(screen.queryByText(t('todayPage.todayPriorityCard.risk'))).not.toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', async () => {
    const onAction = vi.fn();
    const priority = makePriority({ actionLabel: 'Close position' });
    const { user } = renderWithProviders(<TodayPriorityCard priority={priority} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Close position' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('shows the correct kind label for close_position', () => {
    const priority = makePriority({
      kind: 'close_position',
      headline: 'AAPL needs to be closed',
      reason: 'Stop triggered.',
      actionLabel: 'Close position',
    });
    renderWithProviders(<TodayPriorityCard priority={priority} onAction={() => {}} />);
    expect(screen.getByText(t('todayPage.todayPriorityCard.kinds.close_position'))).toBeInTheDocument();
  });

  it('shows the correct kind label for best_candidate', () => {
    const priority = makePriority({
      kind: 'best_candidate',
      headline: 'GOOG looks ready to buy.',
      reason: 'Strong momentum.',
      actionLabel: 'Prepare order',
    });
    renderWithProviders(<TodayPriorityCard priority={priority} onAction={() => {}} />);
    expect(screen.getByText(t('todayPage.todayPriorityCard.kinds.best_candidate'))).toBeInTheDocument();
  });

  it('shows the correct kind label for no_action', () => {
    const priority = makePriority({ kind: 'no_action' });
    renderWithProviders(<TodayPriorityCard priority={priority} onAction={() => {}} />);
    expect(screen.getByText(t('todayPage.todayPriorityCard.kinds.no_action'))).toBeInTheDocument();
  });

  it('shows the card title', () => {
    const priority = makePriority({});
    renderWithProviders(<TodayPriorityCard priority={priority} onAction={() => {}} />);
    expect(screen.getByText(t('todayPage.todayPriorityCard.title'))).toBeInTheDocument();
  });
});
