import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { t } from '@/i18n/t';
import type { Position } from '@/types/position';
import PortfolioRiskSummary from './PortfolioRiskSummary';

const openPositions: Position[] = [
  {
    ticker: 'AAPL',
    status: 'open',
    entryDate: '2026-06-01',
    entryPrice: 100,
    stopPrice: 95,
    shares: 10,
    initialRisk: 50,
    currentPrice: 110,
  },
  {
    ticker: 'MSFT',
    status: 'open',
    entryDate: '2026-06-05',
    entryPrice: 200,
    stopPrice: 190,
    shares: 5,
    initialRisk: 50,
    currentPrice: 195,
  },
];

describe('PortfolioRiskSummary', () => {
  it('shows the four kept metrics', () => {
    renderWithProviders(<PortfolioRiskSummary openPositions={openPositions} accountSize={10000} />);

    expect(screen.getByText(t('portfolioRisk.openPositions'))).toBeInTheDocument();
    expect(screen.getByText(t('portfolioRisk.totalRisk'))).toBeInTheDocument();
    expect(screen.getByText(t('portfolioRisk.portfolioHeat'))).toBeInTheDocument();
    expect(screen.getByText(t('portfolioRisk.avgRNow'))).toBeInTheDocument();
  });

  it('does not render the effective-equity or realized-PnL chips', () => {
    renderWithProviders(<PortfolioRiskSummary openPositions={openPositions} accountSize={10000} />);

    expect(screen.queryByText('Equity')).not.toBeInTheDocument();
    expect(screen.queryByText('Realized P&L')).not.toBeInTheDocument();
  });
});
