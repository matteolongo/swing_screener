import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, within, waitForQueriesToSettle } from '@/test/utils';
import { act } from '@testing-library/react';
import StrategyPage from './Strategy';

describe('Strategy Page', () => {
  it('renders strategy editor and loads options', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    expect(
      await screen.findByRole('heading', { name: /^Strategy$/ })
    ).toBeInTheDocument();

    const select = await screen.findByLabelText(/choose strategy/i);
    expect(select).toBeInTheDocument();

    expect(within(select).getByRole('option', { name: 'Default' })).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('toggles advanced settings', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    expect(screen.queryByText('SMA Fast')).not.toBeInTheDocument();

    const toggle = await screen.findByRole('button', { name: /show advanced/i });
    await act(async () => {
      await user.click(toggle);
    });

    expect(await screen.findByText('SMA Fast')).toBeInTheDocument();
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
});
