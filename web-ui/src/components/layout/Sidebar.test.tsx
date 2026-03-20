import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Sidebar from './Sidebar';

// Mock the strategy hooks
vi.mock('@/features/strategy/hooks', () => ({
  useStrategiesQuery: () => ({
    data: [
      { id: 'strategy-1', name: 'Test Strategy', isDefault: true },
    ],
    isLoading: false,
    isError: false,
  }),
  useActiveStrategyQuery: () => ({
    data: { id: 'strategy-1', name: 'Test Strategy', isDefault: true },
    isLoading: false,
    isError: false,
  }),
  useSetActiveStrategyMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render all navigation items', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Daily Review')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
  });

  it('should not show mode toggle', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByText('Mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Beginner')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
  });

  it('should show active strategy selector', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Active Strategy')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Test Strategy')).toBeInTheDocument();
  });
});
