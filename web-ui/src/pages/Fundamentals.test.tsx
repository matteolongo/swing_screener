import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import FundamentalsPage from './Fundamentals';

describe('Fundamentals Page', () => {
  it('renders the page heading and description', async () => {
    renderWithProviders(<FundamentalsPage />, { route: '/fundamentals' });

    expect(await screen.findByRole('heading', { name: 'Fundamentals' })).toBeInTheDocument();
    expect(
      screen.getByText('Compare company-quality snapshots without changing the screener ranking.')
    ).toBeInTheDocument();
  });

  it('disables compare button when fewer than two symbols are entered', async () => {
    renderWithProviders(<FundamentalsPage />, { route: '/fundamentals' });

    const input = await screen.findByLabelText('Symbols');
    const compareButton = screen.getByRole('button', { name: /Compare fundamentals/i });

    await act(async () => {
      await import('@testing-library/user-event').then(({ default: userEvent }) =>
        userEvent.setup().clear(input)
      );
    });

    await waitFor(() => {
      expect(compareButton).toBeDisabled();
    });
  });

  it('enables compare button when two or more symbols are entered', async () => {
    renderWithProviders(<FundamentalsPage />, { route: '/fundamentals' });

    // Default input 'AAPL, MSFT' has 2 symbols — button should be enabled
    const compareButton = await screen.findByRole('button', { name: /Compare fundamentals/i });
    expect(compareButton).not.toBeDisabled();
  });

  it('shows snapshot cards after a successful compare', async () => {
    const { user } = renderWithProviders(<FundamentalsPage />, { route: '/fundamentals' });

    const compareButton = await screen.findByRole('button', { name: /Compare fundamentals/i });
    expect(compareButton).not.toBeDisabled();

    await act(async () => {
      await user.click(compareButton);
    });

    await waitFor(() => {
      // MSW returns AAPL and MSFT snapshots
      expect(screen.getByText('AAPL Inc.')).toBeInTheDocument();
      expect(screen.getByText('MSFT Inc.')).toBeInTheDocument();
    });
  });
});
