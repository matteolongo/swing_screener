import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, within, waitForQueriesToSettle } from '@/test/utils';
import { act } from '@testing-library/react';
import StrategyPage from './Strategy';
import { t } from '@/i18n/t';

describe('Strategy Page', () => {
  it('renders strategy editor and loads options', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    expect(
	      await screen.findByRole('heading', { name: t('strategyPage.header.title') })
    ).toBeInTheDocument();
    expect(await screen.findByText(t('strategyCapitalRisk.title'))).toBeInTheDocument();

    const select = await screen.findByLabelText(/choose strategy/i);
    expect(select).toBeInTheDocument();

    expect(within(select).getByRole('option', { name: 'Default' })).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('reveals advanced settings when expanded', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    // Advanced settings card is always present but collapsed by default
    expect(screen.queryByText(t('strategyPage.advanced.fields.smaFast'))).not.toBeInTheDocument();

    const advancedToggle = await screen.findByRole('button', { name: t('strategyPage.advanced.actions.show') });
    await act(async () => {
      await user.click(advancedToggle);
    });

    expect(await screen.findByText(t('strategyPage.advanced.fields.smaFast'))).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('disables delete for default strategy', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    const manageButton = await screen.findByRole('button', { name: t('strategyPage.selection.manageStrategies') });
    await act(async () => {
      await user.click(manageButton);
    });
    const deleteButton = await screen.findByRole('button', { name: t('common.actions.delete') });
    expect(deleteButton).toBeDisabled();
    await waitForQueriesToSettle(queryClient);
  });

  it('can save a strategy as new', async () => {
    const { user, queryClient } = renderWithProviders(<StrategyPage />);

    const manageButton = await screen.findByRole('button', { name: t('strategyPage.selection.manageStrategies') });
    await act(async () => {
      await user.click(manageButton);
    });
    const idInput = await screen.findByLabelText(t('strategyPage.create.newId'));
    const nameInput = screen.getByLabelText(t('strategyPage.create.newName'));

    await act(async () => {
      await user.type(idInput, 'breakout_v2');
      await user.type(nameInput, 'Breakout v2');
    });

    const saveButton = screen.getByRole('button', { name: t('strategyPage.create.saveAsNew') });
    await act(async () => {
      await user.click(saveButton);
    });

    expect(await screen.findByText(/saved as new strategy/i)).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Breakout v2' })).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('renders currency filter selector', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    expect(await screen.findByRole('textbox', { name: /currencies/i })).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('keeps lifecycle controls behind Manage strategies', async () => {
    const { user } = renderWithProviders(<StrategyPage />);

    expect(await screen.findByLabelText(/choose strategy/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save as new/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/new id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/new name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/new description/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /manage strategies/i }));
    });

    expect(screen.getByRole('button', { name: /save as new/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/new id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});
