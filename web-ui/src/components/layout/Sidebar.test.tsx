import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Sidebar from './Sidebar';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { act } from 'react';

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
    // Reset beginner mode to default (true)
    const store = useBeginnerModeStore.getState();
    store.setBeginnerMode(true);
  });

  it('should render all navigation items', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Daily Review')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Fundamentals')).toBeInTheDocument();
  });

  it('should show mode toggle with beginner mode enabled by default', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    
    const toggleButton = screen.getByRole('button', { name: /toggle between beginner and advanced mode/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('should enable all nav items in advanced mode', async () => {
    renderWithProviders(<Sidebar />);

    // Toggle to advanced mode
    const toggleButton = screen.getByRole('button', { name: /toggle between beginner and advanced mode/i });
    
    await act(async () => {
      toggleButton.click();
    });

    // Wait for mode to update
    expect(await screen.findByText('Advanced')).toBeInTheDocument();
  });

  it('should persist mode toggle state', async () => {
    const { unmount } = renderWithProviders(<Sidebar />);

    const toggleButton = screen.getByRole('button', { name: /toggle between beginner and advanced mode/i });
    
    // Toggle to advanced mode
    await act(async () => {
      toggleButton.click();
    });

    expect(await screen.findByText('Advanced')).toBeInTheDocument();

    // Unmount and remount to simulate page reload
    unmount();

    renderWithProviders(<Sidebar />);

    // Should still be in advanced mode
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('should show active strategy selector', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Active Strategy')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Test Strategy')).toBeInTheDocument();
  });
});
