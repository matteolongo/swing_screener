import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OrderReviewExperience from './OrderReviewExperience';
import type { OrderReviewContext } from './OrderReviewExperience';
import type { RiskConfig } from '@/types/config';

vi.mock('@/features/portfolio/api', () => ({
  fetchPortfolioSummary: () =>
    Promise.resolve({
      totalPositions: 0,
      totalValue: 0,
      totalCostBasis: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      openRisk: 0,
      openRiskPercent: 0,
      accountSize: 50000,
      availableCapital: 50000,
      largestPositionValue: 0,
      largestPositionTicker: '',
      bestPerformerTicker: '',
      bestPerformerPnlPct: 0,
      worstPerformerTicker: '',
      worstPerformerPnlPct: 0,
      avgRNow: 0,
      positionsProfitable: 0,
      positionsLosing: 0,
      winRate: 0,
      concentration: [],
      realizedPnl: 0,
      effectiveAccountSize: 50000,
    }),
  createOrder: vi.fn().mockResolvedValue({}),
}));

const risk: RiskConfig = {
  accountSize: 50000,
  riskPct: 0.01,
  maxPositionPct: 0.6,
  minShares: 1,
  kAtr: 2,
  minRr: 2,
  maxFeeRiskPct: 0.2,
};

function makeContext(overrides: Partial<OrderReviewContext> = {}): OrderReviewContext {
  return {
    ticker: 'AAPL',
    signal: 'breakout',
    entry: 20.0,
    stop: 18.0,
    close: 20.5,
    shares: 100,
    currency: 'USD',
    ...overrides,
  };
}

describe('OrderReviewExperience — liquidity slippage warning', () => {
  it('shows slippage warning when order notional exceeds 5% of ADV', async () => {
    // shares=100, entry=20 → notional=2000; ADV=10_000 → 20% > 5% → warning
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ avgDailyVolumeEur: 10_000 })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    // Warning renders in two places (decision section + form) — getAllByText
    const matches = await screen.findAllByText(/20\.0%.*avg daily volume/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('does not show slippage warning when ADV is null', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ avgDailyVolumeEur: null })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    // Wait for form to be present
    await screen.findByRole('region', { name: /Order review sections/i });
    expect(screen.queryByText(/avg daily volume/i)).toBeNull();
  });

  it('does not show slippage warning when order notional is within 5% of ADV', async () => {
    // shares=100, entry=20 → notional=2000; ADV=1_000_000 → 0.2% < 5% → no warning
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ avgDailyVolumeEur: 1_000_000 })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    await screen.findByRole('region', { name: /Order review sections/i });
    expect(screen.queryByText(/avg daily volume/i)).toBeNull();
  });
});
