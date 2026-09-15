import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';

vi.mock('@/features/portfolio/hooks', () => ({
  usePositions: () => ({ data: [], isLoading: false, isError: false }),
  usePortfolioSummary: () => ({
    isLoading: false, isError: false,
    data: { analytics: {
      closedTradeCount: 2, excludedTradeCount: 0, winCount: 1, lossCount: 1, scratchCount: 0,
      winRate: 50, winRateStatus: 'negative', averageR: 0.5, averageMaxR: null, profitFactor: 2, profitFactorStatus: 'negative', averageHoldingDays: 4, maxWinStreak: 1,
      maxLossStreak: 1, equityCurve: [], tagBreakdown: [], journalTagBreakdown: [],
      insight: { verdict: 'positive', reason: 'positive_edge' },
    } },
  }),
}));

vi.mock('@/components/domain/portfolio/EdgeBreakdownTable', () => ({ default: () => null }));
vi.mock('@/components/domain/portfolio/RegimeBreakdownTable', () => ({ default: () => null }));
vi.mock('@/components/domain/analytics/AnalyticsCharts', () => ({ EquityCurveChart: () => null, RDistributionChart: () => null }));
vi.mock('@/components/domain/analytics/AnalyticsCards', () => ({ EdgeInsightCard: () => null, HowToReadBox: () => null, StatCard: ({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) => <div data-testid={label} data-color={colorClass}>{label}: {value}</div> }));
vi.mock('@/components/domain/analytics/AnalyticsTradeTable', () => ({ default: () => null }));

import Analytics from './Analytics';

describe('Analytics page', () => {
  it('renders canonical summary analytics rather than calculating closed positions', () => {
    renderWithProviders(<Analytics />);
    expect(screen.getByText(`${t('analyticsPage.stats.winRate')}: 50.0%`)).toBeInTheDocument();
    expect(screen.getByText(`${t('analyticsPage.stats.avgR')}: +0.50R`)).toBeInTheDocument();
    expect(screen.getByTestId(t('analyticsPage.stats.winRate'))).toHaveAttribute('data-color', 'text-danger');
    expect(screen.getByTestId(t('analyticsPage.stats.profitFactor'))).toHaveAttribute('data-color', 'text-danger');
  });
});
