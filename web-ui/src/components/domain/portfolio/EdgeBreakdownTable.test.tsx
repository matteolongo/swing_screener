import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import EdgeBreakdownTable from './EdgeBreakdownTable';
import { t } from '@/i18n/t';

describe('EdgeBreakdownTable', () => {
  it('renders the backend canonical tag rows without deriving a threshold or expectancy', () => {
    renderWithProviders(<EdgeBreakdownTable rows={[{
      tag: 'breakout', tradeCount: 5, winCount: 3, lossCount: 1, scratchCount: 1,
      winRate: 75, averageR: 0.8, expectancy: 0.8,
    }]} />);
    expect(screen.getByText(t('tradeTags.breakout'))).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders empty state when the canonical response has no qualified tags', () => {
    renderWithProviders(<EdgeBreakdownTable rows={[]} />);
    expect(screen.getByText(t('analyticsPage.edgeBreakdown.emptyState'))).toBeInTheDocument();
  });
});
