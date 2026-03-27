import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import PortfolioTable from '@/components/domain/workspace/PortfolioTable';
import { renderWithProviders } from '@/test/utils';

const setSelectedTicker = vi.fn();
const setAnalysisTab = vi.fn();

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: unknown) => unknown) =>
    selector({
      selectedTicker: null,
      setSelectedTicker,
      setAnalysisTab,
    }),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  usePositions: () => ({
    data: [
      {
        positionId: 'POS-CRBN-1',
        ticker: 'CRBN.AS',
        status: 'open',
        entryPrice: 18.48,
        currentPrice: 18.61,
        stopPrice: 18.06,
        shares: 20,
        pnl: -2.3,
        pnlPercent: -0.62,
        broker: 'degiro',
        brokerAvgCost: null,
        brokerSymbol: 'CRBN',
        isin: 'NL0010583399',
      },
    ],
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
  useCancelOrderMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useClosePositionMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useFillOrderMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useUpdateStopMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('@/components/domain/orders/FillOrderModalForm', () => ({
  default: () => null,
}));

vi.mock('@/components/domain/positions/ClosePositionModalForm', () => ({
  default: () => null,
}));

vi.mock('@/components/domain/positions/UpdateStopModalForm', () => ({
  default: () => null,
}));

describe('PortfolioTable', () => {
  it('shows a reconciliation warning when a DeGiro position has no broker PMC', () => {
    renderWithProviders(<PortfolioTable />);

    expect(screen.getByText('broker basis missing')).toBeInTheDocument();
    expect(screen.getByText('CRBN · NL0010583399')).toBeInTheDocument();
    expect(screen.getByText(/Broker sync has no PMC yet/i)).toBeInTheDocument();
  });
});
