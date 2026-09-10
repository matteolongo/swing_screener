import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import PortfolioRiskSummary from './PortfolioRiskSummary';
import { t } from '@/i18n/t';

describe('PortfolioRiskSummary', () => {
  it('renders backend-owned heat and risk values without deriving them from positions', () => {
    renderWithProviders(<PortfolioRiskSummary summary={{
      totalPositions: 2, totalValue: 0, totalCostBasis: 0, totalPnl: 0, totalPnlPercent: 0,
      openRisk: 120, openRiskPercent: 12, accountSize: 1000, availableCapital: 0,
      largestPositionValue: 0, largestPositionTicker: '', bestPerformerTicker: '', bestPerformerPnlPct: 0,
      worstPerformerTicker: '', worstPerformerPnlPct: 0, avgRNow: 1.25, positionsProfitable: 0,
      positionsLosing: 0, winRate: 0, concentration: [], realizedPnl: 50, effectiveAccountSize: 1050,
      analytics: { closedTradeCount: 0, excludedTradeCount: 0, winCount: 0, lossCount: 0, scratchCount: 0,
        winRate: null, winRateStatus: 'neutral', averageR: null, averageMaxR: null, profitFactor: null, profitFactorStatus: 'neutral', averageHoldingDays: null, maxWinStreak: 0,
        maxLossStreak: 0, equityCurve: [], tagBreakdown: [], journalTagBreakdown: [],
        insight: { verdict: 'developing', reason: 'insufficient_history' } },
      analyticsMetadata: { heatStatus: 'danger', heatWarningPct: 4, heatMaxPct: 6, concentrationWarningPct: 60, tagMinSampleSize: 5 },
    }} />);
    expect(screen.getByText(t('portfolioRisk.openPositions'))).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('12.0%')).toBeInTheDocument();
  });
});
