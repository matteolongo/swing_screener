import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/utils';
import StrategyPage from './Strategy';

describe('Strategy Page', () => {
  it('renders strategy editor and loads options', async () => {
    renderWithProviders(<StrategyPage />);

    expect(
      await screen.findByRole('heading', { name: /^Strategy$/ })
    ).toBeInTheDocument();

    const select = await screen.findByLabelText(/choose strategy/i);
    expect(select).toBeInTheDocument();

    expect(within(select).getByRole('option', { name: 'Default' })).toBeInTheDocument();
  });

  it('toggles advanced settings', async () => {
    renderWithProviders(<StrategyPage />);

    expect(screen.queryByText('SMA Fast')).not.toBeInTheDocument();

    const toggle = await screen.findByRole('button', { name: /show advanced/i });
    await toggle.click();

    expect(await screen.findByText('SMA Fast')).toBeInTheDocument();
  });

  it('disables delete for default strategy', async () => {
    renderWithProviders(<StrategyPage />);

    const deleteButton = await screen.findByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  it('can save a strategy as new', async () => {
    const { user } = renderWithProviders(<StrategyPage />);

    const idInput = await screen.findByLabelText(/new id/i);
    const nameInput = screen.getByLabelText(/new name/i);

    await user.type(idInput, 'breakout_v2');
    await user.type(nameInput, 'Breakout v2');

    const saveButton = screen.getByRole('button', { name: /save as new/i });
    await user.click(saveButton);

    expect(await screen.findByText(/saved as new strategy/i)).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Breakout v2' })).toBeInTheDocument();
  });
});
