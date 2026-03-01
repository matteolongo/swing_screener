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

  it('unlocks advanced settings only after explicit confirmation', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    expect(await screen.findByRole('button', { name: /unlock advanced/i })).toBeInTheDocument();
    expect(screen.queryByText('SMA Fast')).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /unlock advanced/i }));
    });

    expect(await screen.findByText('SMA Fast')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show advanced/i })).not.toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('blocks unsafe save in simple mode and allows save after unlocking advanced', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    const riskInput = await screen.findByLabelText(/risk per trade/i);
    await act(async () => {
      await user.clear(riskInput);
      await user.type(riskInput, '4');
    });
    await waitForQueriesToSettle(queryClient);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /save changes/i }));
    });

    expect(
      await screen.findByText('This configuration violates beginner safety rules.')
    ).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /unlock advanced/i }));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /save changes/i }));
    });

    expect(await screen.findByText('Saved')).toBeInTheDocument();
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

  it('keeps low-level filters hidden until advanced is unlocked', async () => {
    const { user } = renderWithProviders(<StrategyPage />);

    await screen.findByLabelText(/risk per trade/i);

    expect(screen.queryByText('SMA Fast')).not.toBeInTheDocument();

    await act(async () => {
      await user.click(await screen.findByRole('button', { name: /unlock advanced/i }));
    });

    expect(await screen.findByText('SMA Fast')).toBeInTheDocument();
  });

  it('keeps strategy management visible without mobile toggle', async () => {
    renderWithProviders(<StrategyPage />);

    expect(await screen.findByLabelText(/choose strategy/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show management/i })).not.toBeInTheDocument();
  });
});
