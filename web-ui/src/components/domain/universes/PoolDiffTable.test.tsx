import { describe, it, expect } from 'vitest';

import { renderWithProviders, screen } from '@/test/utils';
import PoolDiffTable from './PoolDiffTable';

const additions = [
  {
    symbol: 'NVDA',
    region: 'us',
    exchangeMic: 'XNAS',
    currency: 'USD',
    capTier: null,
    sector: null,
    indexMemberships: ['us_sp500'],
  },
];

const modifications = [
  {
    symbol: 'AAPL',
    changes: [
      { field: 'sector', before: 'Tech', after: 'Healthcare' },
      { field: 'market_cap_tier', before: 'large', after: 'mega' },
    ],
  },
];

describe('PoolDiffTable', () => {
  it('renders tab counts and the active tab content', () => {
    renderWithProviders(
      <PoolDiffTable additions={additions} removals={[]} modifications={modifications} />,
    );
    expect(screen.getByRole('button', { name: 'Additions (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Removals (0)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Modified (1)' })).toBeInTheDocument();
    // Additions is the default active tab.
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });

  it('shows field-level before/after on the Modified tab', async () => {
    const { user } = renderWithProviders(
      <PoolDiffTable additions={[]} removals={[]} modifications={modifications} />,
    );
    await user.click(screen.getByRole('button', { name: 'Modified (1)' }));
    expect(screen.getByText('sector')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('mega')).toBeInTheDocument();
  });

  it('renders a Failed tab only when failedSymbols is provided', () => {
    renderWithProviders(
      <PoolDiffTable modifications={[]} failedSymbols={['0700.HK']} />,
    );
    expect(screen.getByRole('button', { name: 'Failed (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Additions/ })).not.toBeInTheDocument();
  });
});
