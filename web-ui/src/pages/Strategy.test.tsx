import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, within, waitForQueriesToSettle } from '@/test/utils';
import { act } from '@testing-library/react';
import StrategyPage from './Strategy';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';

describe('Strategy Page', () => {
  it('renders strategy editor and loads options', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    expect(
      await screen.findByRole('heading', { name: /^Strategy$/ })
    ).toBeInTheDocument();
    expect(await screen.findByText('Indicator Preview (Educational)')).toBeInTheDocument();

    const select = await screen.findByLabelText(/choose strategy/i);
    expect(select).toBeInTheDocument();

    expect(within(select).getByRole('option', { name: 'Default' })).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('toggles advanced settings via beginner mode', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    // In beginner mode, advanced settings are hidden
    expect(screen.queryByText('SMA Fast')).not.toBeInTheDocument();

    // Find and toggle beginner mode off to access advanced settings
    const beginnerModeCheckbox = await screen.findByRole('checkbox');
    await act(async () => {
      await user.click(beginnerModeCheckbox);
    });

    // Now advanced settings card should be visible, need to expand it
    const advancedToggle = await screen.findByRole('button', { name: /show advanced/i });
    await act(async () => {
      await user.click(advancedToggle);
    });

    expect((await screen.findAllByText('SMA Fast')).length).toBeGreaterThan(0);
    await waitForQueriesToSettle(queryClient);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('disables delete for default strategy', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    const deleteButton = await screen.findByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
    await waitForQueriesToSettle(queryClient);
  });

  it('can save a strategy as new', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    const idInput = await screen.findByLabelText(/new id/i);
    const nameInput = screen.getByLabelText(/new name/i);

    await act(async () => {
      await user.type(idInput, 'breakout_v2');
      await user.type(nameInput, 'Breakout v2');
    });

    const saveButton = screen.getByRole('button', { name: /save as new/i });
    await act(async () => {
      await user.click(saveButton);
    });

    expect(await screen.findByText(/saved as new strategy/i)).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Breakout v2' })).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('renders currency filter selector', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    expect(await screen.findByRole('combobox', { name: /currencies/i })).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('shows strategy management toggle in beginner mobile layout', async () => {
    const originalMatchMedia = window.matchMedia;
    useBeginnerModeStore.setState({ isBeginnerMode: true });
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    try {
      const { user } = renderWithProviders(<StrategyPage />);
      const showManagementButton = await screen.findByRole('button', { name: /show management/i });
      expect(showManagementButton).toBeInTheDocument();

      await act(async () => {
        await user.click(showManagementButton);
      });

      expect(await screen.findByLabelText(/choose strategy/i)).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
      useBeginnerModeStore.setState({ isBeginnerMode: false });
    }
  });
});
