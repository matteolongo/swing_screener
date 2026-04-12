import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Review from './Review';

vi.mock('@/features/portfolio/hooks', () => ({
  usePositions: (status: string) => ({
    data: status === 'open'
      ? [{
          ticker: 'AAPL',
          status: 'open',
          entryDate: '2026-04-01',
          entryPrice: 100,
          stopPrice: 95,
          shares: 10,
          positionId: 'pos-1',
          initialRisk: 5,
          currentPrice: 108,
        }]
      : [],
  }),
}));

vi.mock('@/features/dailyReview/api', () => ({
  useDailyReview: () => ({ data: { positionsHold: [], positionsUpdateStop: [], positionsClose: [] } }),
}));

vi.mock('@/components/domain/review/PositionCaseStudyCard', () => ({
  default: () => <div>Position Case Study Card</div>,
}));

describe('Review Page', () => {
  it('renders the open positions tab by default', () => {
    renderWithProviders(<Review />);

    expect(screen.getByText('Position Case Study Card')).toBeInTheDocument();
  });
});
