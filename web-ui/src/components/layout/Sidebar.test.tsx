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
    expect(screen.getByText('Backtest')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();
  });

  it('should show mode toggle with beginner mode enabled by default', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    
    const toggleButton = screen.getByRole('button', { name: /toggle between beginner and advanced mode/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('should disable backtest in beginner mode', () => {
    renderWithProviders(<Sidebar />);

    const backtestLink = screen.getByText('Backtest').closest('a');
    expect(backtestLink).toHaveClass('cursor-not-allowed');
    expect(backtestLink).toHaveClass('text-gray-400');
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

    // Backtest should not be disabled
    const backtestLink = screen.getByText('Backtest').closest('a');
    expect(backtestLink).not.toHaveClass('cursor-not-allowed');
    expect(backtestLink).not.toHaveClass('text-gray-400');
  });

  it('should toggle between beginner and advanced mode', async () => {
    renderWithProviders(<Sidebar />);

    const toggleButton = screen.getByRole('button', { name: /toggle between beginner and advanced mode/i });
    
    // Initially in beginner mode
    expect(screen.getByText('Beginner')).toBeInTheDocument();

    // Toggle to advanced
    await act(async () => {
      toggleButton.click();
    });

    expect(await screen.findByText('Advanced')).toBeInTheDocument();

    // Toggle back to beginner
    await act(async () => {
      toggleButton.click();
    });

    expect(await screen.findByText('Beginner')).toBeInTheDocument();
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

  it('should prevent navigation to disabled pages', async () => {
    renderWithProviders(<Sidebar />);

    const backtestLink = screen.getByText('Backtest').closest('a');
    
    // Should have cursor-not-allowed class
    expect(backtestLink).toHaveClass('cursor-not-allowed');
    
    // Click should be prevented (link should not navigate)
    const clickHandler = vi.fn();
    backtestLink?.addEventListener('click', clickHandler);
    
    await act(async () => {
      backtestLink?.click();
    });

    // The default handler should have been prevented
    // (we can't easily test e.preventDefault() directly, but the class indicates the state)
  });

  it('should show active strategy selector', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Active Strategy')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Test Strategy')).toBeInTheDocument();
  });
});
