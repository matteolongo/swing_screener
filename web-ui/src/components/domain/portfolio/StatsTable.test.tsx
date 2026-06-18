import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import StatsTable, { type StatsTableHeaders, type StatsTableRow } from './StatsTable';

const HEADERS: StatsTableHeaders = {
  label: t('analyticsPage.edgeBreakdown.colTag'),
  trades: t('analyticsPage.edgeBreakdown.colTrades'),
  winRate: t('analyticsPage.edgeBreakdown.colWinRate'),
  avgR: t('analyticsPage.edgeBreakdown.colAvgR'),
  expectancy: t('analyticsPage.edgeBreakdown.colExpectancy'),
  expectancyHint: t('analyticsPage.edgeBreakdown.expectancyHint'),
};

describe('StatsTable', () => {
  it('renders all column headers', () => {
    renderWithProviders(<StatsTable headers={HEADERS} rows={[]} />);

    expect(screen.getByText(HEADERS.label)).toBeInTheDocument();
    expect(screen.getByText(HEADERS.trades)).toBeInTheDocument();
    expect(screen.getByText(HEADERS.winRate)).toBeInTheDocument();
    expect(screen.getByText(HEADERS.avgR)).toBeInTheDocument();
    expect(screen.getByText(HEADERS.expectancy)).toBeInTheDocument();
  });

  it('renders a row with label, rounded win rate, and trade count', () => {
    const rows: StatsTableRow[] = [
      { key: 'breakout', label: t('tradeTags.breakout'), count: 6, winRate: 66.67, avgR: 1.2, expectancy: 0.8 },
    ];

    renderWithProviders(<StatsTable headers={HEADERS} rows={rows} />);

    expect(screen.getByText(t('tradeTags.breakout'))).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('applies labelClassName to the first cell', () => {
    const rows: StatsTableRow[] = [
      { key: 'up', label: 'Trending Up', labelClassName: 'text-success', count: 12, winRate: 50, avgR: 1, expectancy: 0.5 },
    ];

    const { container } = renderWithProviders(<StatsTable headers={HEADERS} rows={rows} />);

    const labelCell = screen.getByText('Trending Up');
    expect(labelCell).toHaveClass('text-success');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('surfaces the expectancy hint as a title attribute', () => {
    renderWithProviders(<StatsTable headers={HEADERS} rows={[]} />);

    expect(screen.getByText(HEADERS.expectancy)).toHaveAttribute('title', HEADERS.expectancyHint);
  });
});
