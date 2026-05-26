import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import Header from './Header';

describe('Header', () => {
  beforeEach(() => {
    useBeginnerModeStore.setState({ isBeginnerMode: true });
  });

  it('hides compact risk summary in beginner mode', async () => {
    renderWithProviders(<Header />);

    await screen.findByRole('combobox', { name: 'Active Strategy' });

    await waitFor(() => {
      expect(screen.queryByText('Risk / trade')).not.toBeInTheDocument();
    });
  });

  it('shows compact risk summary in advanced mode', async () => {
    useBeginnerModeStore.setState({ isBeginnerMode: false });

    renderWithProviders(<Header />);

    expect(await screen.findByText(/Risk \/ trade/)).toBeInTheDocument();
  });
});
