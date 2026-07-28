import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SymbolFundamentalsTab, {
  type SymbolFundamentalsTabModel,
} from '@/components/domain/workspace/SymbolFundamentalsTab';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import { formatDateTime } from '@/utils/formatters';

const staleSnapshot: FundamentalSnapshot = {
  symbol: 'AAPL',
  asofDate: '2026-06-30',
  provider: 'yfinance',
  updatedAt: '2026-07-26T18:30:00Z',
  instrumentType: 'equity',
  supported: true,
  coverageStatus: 'partial',
  freshnessStatus: 'stale',
  companyName: 'Apple Inc.',
  revenueGrowthYoy: 0.06,
  operatingMargin: 0.31,
  freeCashFlowMargin: 0.24,
  trailingPe: 28,
  priceToBook: 11,
  pillars: {
    growth: { score: 0.7, status: 'strong', summary: 'Revenue is growing.' },
  },
  historicalSeries: {},
  metricContext: {},
  dataQualityStatus: 'medium',
  dataQualityFlags: [],
  redFlags: [],
  highlights: ['Revenue remains supportive.'],
  metricSources: {},
};

function model(
  overrides: Partial<SymbolFundamentalsTabModel> = {},
): SymbolFundamentalsTabModel {
  return {
    ticker: 'AAPL',
    snapshot: staleSnapshot,
    isLoading: false,
    isRefreshing: false,
    error: null,
    intelligenceOutdated: false,
    screenerFundamentalsInputAsOf: '2026-07-25T20:00:00Z',
    onRefresh: vi.fn(),
    ...overrides,
  };
}

describe('SymbolFundamentalsTab', () => {
  const reliabilityCases: Array<{
    name: string;
    overrides: Partial<SymbolFundamentalsTabModel>;
    expected: string;
  }> = [
    { name: 'no-data', overrides: { snapshot: undefined }, expected: t('workspacePage.fundamentals.noSnapshot') },
    { name: 'fresh', overrides: { snapshot: { ...staleSnapshot, freshnessStatus: 'current' } }, expected: staleSnapshot.companyName! },
    { name: 'cached', overrides: { snapshot: { ...staleSnapshot, freshnessStatus: 'current' } }, expected: formatDateTime(staleSnapshot.updatedAt) },
    { name: 'stale', overrides: {}, expected: t('workspacePage.data.stale') },
    { name: 'refreshing-with-data', overrides: { isRefreshing: true }, expected: t('workspacePage.data.refreshing') },
    { name: 'partial', overrides: { error: new Error('Fundamentals partial') }, expected: 'Fundamentals partial' },
    { name: 'failed', overrides: { snapshot: undefined, error: new Error('Fundamentals failed') }, expected: 'Fundamentals failed' },
    { name: 'timeout', overrides: { snapshot: undefined, error: new Error('Fundamentals timed out') }, expected: 'Fundamentals timed out' },
    { name: 'malformed', overrides: { snapshot: undefined, error: new Error('Fundamentals malformed') }, expected: 'Fundamentals malformed' },
  ];

  it.each(reliabilityCases)('renders its own $name contract without an empty panel', ({ overrides, expected }) => {
    renderWithProviders(<SymbolFundamentalsTab model={model(overrides)} />);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it('shows a stale snapshot with its original timestamp while refreshing', async () => {
    const { user } = renderWithProviders(
      <SymbolFundamentalsTab model={model({ isRefreshing: true })} />,
    );

    expect(screen.getAllByText(t('workspacePage.data.stale')).length).toBeGreaterThan(0);
    expect(screen.getByText(formatDateTime(staleSnapshot.updatedAt))).toBeVisible();
    expect(screen.getByText(t('workspacePage.data.refreshing'))).toBeVisible();
    expect(screen.getByText(staleSnapshot.companyName!)).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: t('workspacePage.data.showActivity') }),
    );
    expect(
      screen.getByText(
        t('workspacePage.fundamentals.providerActivity', {
          provider: staleSnapshot.provider,
        }),
      ),
    ).toBeVisible();
  });

  it('groups unavailable metrics instead of rendering repeated n/a cards', () => {
    renderWithProviders(<SymbolFundamentalsTab model={model()} />);

    expect(
      screen.getByText(
        t('workspacePage.fundamentals.unavailableCount', { count: 6 }),
      ),
    ).toBeVisible();
    expect(screen.queryAllByText('n/a').length).toBeLessThan(3);
  });

  it('marks newer fundamentals as making intelligence outdated without regenerating it', () => {
    const onRefresh = vi.fn();
    renderWithProviders(
      <SymbolFundamentalsTab
        model={model({ intelligenceOutdated: true, onRefresh })}
      />,
    );

    expect(
      screen.getByText(t('workspacePage.fundamentals.intelligenceOutdated')),
    ).toBeVisible();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('keeps the last snapshot visible when a refresh fails', () => {
    renderWithProviders(
      <SymbolFundamentalsTab
        model={model({ error: new Error('Provider unavailable') })}
      />,
    );

    expect(screen.getByText('Provider unavailable')).toBeVisible();
    expect(screen.getByText(staleSnapshot.companyName!)).toBeVisible();
  });

  it('labels screener fundamentals as historical decision context', () => {
    renderWithProviders(<SymbolFundamentalsTab model={model()} />);

    expect(
      screen.getByText(
        t('workspacePage.fundamentals.screenerInputAsOf', {
          date: formatDateTime('2026-07-25T20:00:00Z'),
        }),
      ),
    ).toBeVisible();
  });
});
