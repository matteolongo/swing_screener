import { describe, it, expect } from 'vitest';
import { screen, renderWithProviders, waitForQueriesToSettle } from '@/test/utils';
import StrategyPage from './Strategy';

describe('Strategy Page', () => {
  it('renders strategy editor and loads options', async () => {
    const { queryClient } = renderWithProviders(<StrategyPage />);

    expect(await screen.findByRole('heading', { name: /^Strategy$/ })).toBeInTheDocument();
    expect(await screen.findByLabelText(/choose strategy/i)).toBeInTheDocument();
    await waitForQueriesToSettle(queryClient);
  });

  it('always renders core strategy settings', async () => {
    renderWithProviders(<StrategyPage />);

    expect(await screen.findByText('Basics')).toBeInTheDocument();
    expect(screen.getByLabelText(/account size/i)).toBeInTheDocument();
  });

  it('keeps advanced settings available without a mode toggle', async () => {
    const { user } = renderWithProviders(<StrategyPage />);

    const toggle = await screen.findByRole('button', { name: /show advanced/i });
    await user.click(toggle);

    expect(await screen.findByText('SMA Fast')).toBeInTheDocument();
    expect(screen.queryByText(/beginner mode/i)).not.toBeInTheDocument();
  });
});
