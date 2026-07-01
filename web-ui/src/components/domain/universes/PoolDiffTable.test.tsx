import { describe, it, expect } from 'vitest';

import { renderWithProviders, screen } from '@/test/utils';
import { t } from '@/i18n/t';
import PoolDiffTable from './PoolDiffTable';

const tabName = (key: Parameters<typeof t>[0], count: number) => `${t(key)} (${count})`;

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
      { field: 'Sector', before: 'Tech', after: 'Healthcare' },
      { field: 'Market Cap Tier', before: 'large', after: 'mega' },
    ],
  },
];

describe('PoolDiffTable', () => {
  it('renders tab counts and the active tab content', () => {
    renderWithProviders(
      <PoolDiffTable additions={additions} removals={[]} modifications={modifications} />,
    );
    expect(
      screen.getByRole('button', { name: tabName('poolAdmin.diff.additions', 1) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: tabName('poolAdmin.diff.removals', 0) }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: tabName('poolAdmin.diff.modified', 1) }),
    ).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });

  it('shows field-level before/after on the Modified tab', async () => {
    const { user } = renderWithProviders(
      <PoolDiffTable additions={[]} removals={[]} modifications={modifications} />,
    );
    await user.click(screen.getByRole('button', { name: tabName('poolAdmin.diff.modified', 1) }));
    expect(screen.getByText('Sector')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('mega')).toBeInTheDocument();
  });

  it('renders a Failed tab only when failedSymbols is provided', () => {
    renderWithProviders(<PoolDiffTable modifications={[]} failedSymbols={['0700.HK']} />);
    expect(
      screen.getByRole('button', { name: tabName('poolAdmin.diff.failed', 1) }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: new RegExp(t('poolAdmin.diff.additions')) }),
    ).not.toBeInTheDocument();
  });
});
