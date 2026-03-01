import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Sidebar from './Sidebar';

vi.mock('@/features/strategy/hooks', () => ({
  useStrategiesQuery: () => ({
    data: [{ id: 'strategy-1', name: 'Test Strategy', isDefault: true }],
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
  it('renders navigation items without intelligence', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Daily Review')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.queryByText('Intelligence')).not.toBeInTheDocument();
  });

  it('shows active strategy selector', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Active Strategy')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Test Strategy')).toBeInTheDocument();
  });
});
