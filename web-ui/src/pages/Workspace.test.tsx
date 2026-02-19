import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Workspace from './Workspace';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

describe('Workspace Page', () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboardingStore.setState({ status: 'completed', currentStep: 0 });
    useScreenerStore.setState({ lastResult: null });
    useWorkspaceStore.setState({
      selectedTicker: null,
      tradeThesisByTicker: {},
      runScreenerTrigger: 0,
    });
  });

  it('renders the workspace panel structure', async () => {
    renderWithProviders(<Workspace />);

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Screener Inbox')).toBeInTheDocument();
    expect(screen.getByText('Analysis Canvas')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('loads a selected ticker into analysis after screener run', async () => {
    const { user } = renderWithProviders(<Workspace />);

    expect(screen.getByText('Select a candidate from the screener to begin analysis.')).toBeInTheDocument();

    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);

    await screen.findByRole('heading', { name: 'AAPL' });
    await waitFor(() => {
      expect(screen.queryByText('Select a candidate from the screener to begin analysis.')).not.toBeInTheDocument();
    });
  });

  it('loads a portfolio ticker into analysis when clicking the portfolio table', async () => {
    const { user } = renderWithProviders(<Workspace />);

    await screen.findByText('VALE');
    await user.click(screen.getByText('VALE'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'VALE' })).toBeInTheDocument();
      expect(screen.getByText('No screener metrics are available for this ticker yet.')).toBeInTheDocument();
    });
  });
});
