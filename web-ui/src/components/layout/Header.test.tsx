import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Header from './Header';

describe('Header', () => {
  it('shows the compact risk summary', async () => {
    renderWithProviders(<Header />);

    await screen.findByRole('combobox', { name: 'Active Strategy' });
    expect(await screen.findByText(/Risk \/ trade/)).toBeInTheDocument();
  });
});
