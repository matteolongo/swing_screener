import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Journal from './Journal';

vi.mock('@/features/portfolio/hooks', () => ({
  usePositions: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/features/weeklyReview/hooks', () => ({
  useWeeklyReviews: () => ({
    data: [],
  }),
}));

vi.mock('@/components/domain/journal/WeeklyLearningPrompts', () => ({
  default: () => <div>Weekly Learning Prompts</div>,
}));

describe('Journal Page', () => {
  it('renders this week and past weeks sections', () => {
    renderWithProviders(<Journal />);

    expect(screen.getByText('Weekly Learning Prompts')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('Past Weeks')).toBeInTheDocument();
  });
});
