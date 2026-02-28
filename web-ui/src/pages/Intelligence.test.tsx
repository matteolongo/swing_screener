import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import IntelligencePage from './Intelligence';

describe('Intelligence Page', () => {
  it('shows mobile sticky run guidance and opens workspace after opportunities are ready', async () => {
    const { user } = renderWithProviders(<IntelligencePage />, { route: '/intelligence' });

    expect(await screen.findByRole('heading', { name: 'Intelligence' })).toBeInTheDocument();
    expect(screen.getByText('Add symbols to enable run')).toBeInTheDocument();

    const manualSymbols = screen.getByLabelText(/manual symbols/i);
    await act(async () => {
      await user.type(manualSymbols, 'AAPL');
    });

    await waitFor(() => {
      expect(screen.getByText('Ready to run intelligence')).toBeInTheDocument();
    });

    const runButtons = screen.getAllByRole('button', { name: /^Run$/i });
    await act(async () => {
      await user.click(runButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open Workspace' })).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Open Workspace' }));
    });

    expect(screen.getByRole('heading', { name: 'Intelligence' })).toBeInTheDocument();
  });
});
