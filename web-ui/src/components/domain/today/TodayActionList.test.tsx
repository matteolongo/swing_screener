import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import TodayActionList from './TodayActionList';

// Minimal daily-review payload: one open position that is NO_ACTION (hold).
vi.mock('@/features/dailyReview/api', () => ({
  useDailyReview: () => ({
    data: {
      summary: { reviewDate: '2026-06-26', newCandidates: 0, updateStop: 0, closePositions: 0 },
      watchlistNearTrigger: [],
      positionsClose: [],
      positionsUpdateStop: [],
      positionsExitSignal: [],
      pendingOrdersReview: [],
      newCandidates: [],
      positionsAddOnCandidates: [],
      positionsHold: [{ ticker: 'LRCX', positionId: 'POS-1', trimSuggestion: null }],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

vi.mock('@/features/portfolio/hooks', async (orig) => {
  const actual = await orig<typeof import('@/features/portfolio/hooks')>();
  return {
    ...actual,
    usePositions: () => ({
      data: [{ positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3, shares: 1, rNow: 0.51, daysOpen: 10 }],
    }),
    useOpenPositionsIntelligence: () => ({ data: [] }),
  };
});

describe('TodayActionList holdings', () => {
  it('shows held positions under Open Positions and renders no separate Holding section', () => {
    renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    expect(screen.getByText(new RegExp(t('todayPage.actionList.openPositions')))).toBeInTheDocument();
    expect(screen.queryByText(t('todayPage.actionList.holding'))).not.toBeInTheDocument();
    expect(screen.getAllByText('LRCX')).toHaveLength(1);
  });
});
