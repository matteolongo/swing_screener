import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import PortfolioTable from '@/components/domain/workspace/PortfolioTable';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import type { PositionWithMetrics } from '@/features/portfolio/api';

const { positionsMock } = vi.hoisted(() => ({
  positionsMock: vi.fn(),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  usePositions: () => ({
    data: positionsMock(),
    isLoading: false,
    isFetched: true,
    isError: false,
  }),
  useOrders: () => ({
    data: [],
    isLoading: false,
    isFetched: true,
    isError: false,
  }),
  useUpdateStopMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useClosePositionMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useFillOrderMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useCancelOrderMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

function makePosition(overrides: Partial<PositionWithMetrics> = {}): PositionWithMetrics {
  return {
    ticker: 'TEST',
    status: 'open',
    entryDate: '2026-01-01',
    entryPrice: 100,
    stopPrice: 90,
    shares: 10,
    positionId: 'POS-TEST',
    pnl: 0,
    pnlPercent: 0,
    rNow: 0,
    entryValue: 1000,
    currentValue: 1000,
    perShareRisk: 10,
    totalRisk: 100,
    feesEur: 0,
    daysOpen: 0,
    timeStopWarning: false,
    notes: '',
    tags: [],
    ...overrides,
  };
}

describe('PortfolioTable time stop nudge', () => {
  it('shows stale-trade badge for positions with time stop warning', () => {
    positionsMock.mockReturnValue([
      makePosition({ daysOpen: 16, rNow: 0.3, timeStopWarning: true }),
    ]);

    renderWithProviders(<PortfolioTable />);

    expect(screen.getByText(t('bookPage.positions.timeStopBadge', { days: '16', r: '+0.30' }))).toBeInTheDocument();
    expect(screen.getByTitle(t('bookPage.positions.timeStopWarning'))).toBeInTheDocument();
  });

  it('hides stale-trade badge when warning is false', () => {
    positionsMock.mockReturnValue([
      makePosition({ daysOpen: 16, rNow: 1.1, timeStopWarning: false }),
    ]);

    renderWithProviders(<PortfolioTable />);

    expect(screen.queryByTitle(t('bookPage.positions.timeStopWarning'))).not.toBeInTheDocument();
  });
});
