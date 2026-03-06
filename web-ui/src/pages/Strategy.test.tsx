import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitForQueriesToSettle } from '@/test/utils';
import StrategyPage from './Strategy';

describe('Strategy Page', () => {
  it('renders the read-only strategy overview', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    expect(await screen.findByRole('heading', { name: /^Strategy$/ })).toBeInTheDocument();
    expect(await screen.findByText(/read-only strategy dashboard/i)).toBeInTheDocument();
    expect(await screen.findByText('config/strategy.yaml')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /execution graph/i })).toBeInTheDocument();

    await waitForQueriesToSettle(queryClient);
  });

  it('shows validation summary and warnings', async () => {
    renderWithProviders(<StrategyPage />);

    expect(await screen.findByRole('heading', { name: /validation/i })).toBeInTheDocument();
    expect(await screen.findByText(/safety score/i)).toBeInTheDocument();
    expect(await screen.findByText(/breakoutlookback/i)).toBeInTheDocument();
    expect(await screen.findByText(/false breakouts/i)).toBeInTheDocument();
  });

  it('groups plugins by category and shows override source', async () => {
    renderWithProviders(<StrategyPage />);

    expect(await screen.findByRole('heading', { name: /filters/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /qualification/i })).toBeInTheDocument();
    expect(await screen.findByText('Volume Confirmation')).toBeInTheDocument();
    expect(await screen.findByText('Root override')).toBeInTheDocument();
    expect((await screen.findAllByText('Plugin default')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/depends on: breakout_signal/i)).length).toBeGreaterThan(0);
  });

  it('shows enabled and disabled plugin badges', async () => {
    renderWithProviders(<StrategyPage />);

    expect(await screen.findAllByText('Enabled')).not.toHaveLength(0);
    expect(await screen.findAllByText('Disabled')).not.toHaveLength(0);
  });
});
