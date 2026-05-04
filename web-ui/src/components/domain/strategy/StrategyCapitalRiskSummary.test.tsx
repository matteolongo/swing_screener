import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StrategyCapitalRiskSummary from './StrategyCapitalRiskSummary';
import type { Strategy } from '@/features/strategy/types';

const strategy: Strategy = {
  id: 'balanced',
  name: 'Balanced',
  description: 'Balanced strategy',
  module: 'momentum',
  universe: {
    trend: { smaFast: 20, smaMid: 50, smaLong: 200 },
    vol: { atrWindow: 14 },
    mom: { lookback6m: 126, lookback12m: 252, benchmark: 'SPY' },
    filt: {
      minPrice: 5,
      maxPrice: 500,
      maxAtrPct: 15,
      requireTrendOk: true,
      requireRsPositive: false,
      currencies: ['USD', 'EUR'],
    },
  },
  ranking: { wMom6m: 0.45, wMom12m: 0.35, wRs6m: 0.2, topN: 100 },
  signals: { breakoutLookback: 50, pullbackMa: 20, minHistory: 260 },
  risk: {
    accountSize: 800,
    riskPct: 0.025,
    maxPositionPct: 1,
    minShares: 1,
    kAtr: 2,
    minRr: 2,
    rrTarget: 2,
    commissionPct: 0,
    maxFeeRiskPct: 0.2,
    accountSizeMode: 'equity',
    regimeEnabled: false,
    regimeTrendSma: 200,
    regimeTrendMultiplier: 0.5,
    regimeVolAtrWindow: 14,
    regimeVolAtrPctThreshold: 6,
    regimeVolMultiplier: 0.5,
  },
  manage: {
    breakevenAtR: 1,
    trailAfterR: 2,
    trailSma: 20,
    smaBufferPct: 0.005,
    maxHoldingDays: 20,
    benchmark: 'SPY',
  },
  marketIntelligence: {
    enabled: true,
    providers: ['yfinance'],
    universeScope: 'strategy_universe',
    marketContextSymbols: [],
    llm: {
      enabled: false,
      provider: 'mock',
      model: 'gpt-4o-mini',
      baseUrl: '',
      enableCache: true,
      enableAudit: false,
      cachePath: '',
      auditPath: '',
      maxConcurrency: 1,
    },
    catalyst: {
      lookbackHours: 72,
      recencyHalfLifeHours: 48,
      falseCatalystReturnZ: 1.5,
      minPriceReactionAtr: 1,
      requirePriceConfirmation: false,
    },
    theme: {
      enabled: false,
      minClusterSize: 2,
      minPeerConfirmation: 1,
      curatedPeerMapPath: '',
    },
    opportunity: {
      technicalWeight: 0.6,
      catalystWeight: 0.4,
      maxDailyOpportunities: 10,
      minOpportunityScore: 0.5,
    },
  },
  isDefault: false,
  createdAt: '2026-04-16T00:00:00',
  updatedAt: '2026-04-16T00:00:00',
};

describe('StrategyCapitalRiskSummary', () => {
  it('renders the strategy capital risk snapshot', () => {
    render(<StrategyCapitalRiskSummary strategy={strategy} />);

    expect(screen.getByText('Capital Risk at a Glance')).toBeInTheDocument();
    expect(screen.getByText('Account Size')).toBeInTheDocument();
    expect(screen.getAllByText('$800.00')).toHaveLength(2);
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('renders the compact header variant', () => {
    render(<StrategyCapitalRiskSummary strategy={strategy} variant="compact" />);

    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText(/Account \$800.00/)).toBeInTheDocument();
    expect(screen.getByText(/Risk \/ trade \$20.00/)).toBeInTheDocument();
  });

  it('uses effective equity when a portfolio equity snapshot is provided', () => {
    render(
      <StrategyCapitalRiskSummary
        strategy={strategy}
        equitySnapshot={{ effectiveAccountSize: 925, realizedPnl: 125 }}
        variant="compact"
      />,
    );

    expect(screen.getByText(/Equity \$925.00/)).toBeInTheDocument();
    expect(screen.getByText(/Realized P&L \+\$125.00/)).toBeInTheDocument();
    expect(screen.getByText(/Risk \/ trade \$23.13/)).toBeInTheDocument();
  });
});
