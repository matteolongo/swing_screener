import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PortfolioTable from '@/components/domain/workspace/PortfolioTable';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import type { Order } from '@/features/portfolio/types';

const { positionsMock, ordersMock } = vi.hoisted(() => ({
  positionsMock: vi.fn(),
  ordersMock: vi.fn(),
}));

beforeEach(() => {
  ordersMock.mockReturnValue([]);
});

vi.mock('@/components/domain/workspace/SymbolAnalysisContent', () => ({
  default: ({ orderPanel }: { orderPanel: React.ReactNode | ((candidate: unknown) => React.ReactNode) }) => (
    <>{typeof orderPanel === 'function' ? orderPanel({ ticker: 'TEST', currency: 'USD' }) : orderPanel}</>
  ),
}));

vi.mock('@/components/domain/workspace/ActionPanel', () => ({
  default: ({ candidate }: { candidate: { ticker: string } | null }) => (
    <div data-testid="modal-order-candidate">{candidate?.ticker ?? 'none'}</div>
  ),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  usePositions: () => ({
    data: positionsMock(),
    isLoading: false,
    isFetched: true,
    isError: false,
  }),
  useOrders: () => ({
    data: ordersMock(),
    isLoading: false,
    isFetched: true,
    isError: false,
  }),
  useUpdateStopMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useClosePositionMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  usePartialClosePositionMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
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
    priceSource: 'live',
    rUsesInitialRisk: false,
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

describe('PortfolioTable R column', () => {
  it('shows native R for positions without FX adjustment', () => {
    positionsMock.mockReturnValue([
      makePosition({ rNow: 2.0, rFxAdjusted: null }),
    ]);

    renderWithProviders(<PortfolioTable />);

    expect(screen.getByText('+2.00R')).toBeInTheDocument();
    expect(screen.queryByTitle(t('positions.rFxAdjustedTooltip'))).not.toBeInTheDocument();
  });

  it('shows FX-adjusted R as secondary line when rFxAdjusted is set', () => {
    positionsMock.mockReturnValue([
      makePosition({ rNow: 2.0, rFxAdjusted: 1.4 }),
    ]);

    renderWithProviders(<PortfolioTable />);

    expect(screen.getByText('+2.00R')).toBeInTheDocument();
    expect(screen.getByTitle(t('positions.rFxAdjustedTooltip'))).toBeInTheDocument();
  });

  it('shows negative FX-adjusted R correctly', () => {
    positionsMock.mockReturnValue([
      makePosition({ rNow: -0.5, rFxAdjusted: -0.7 }),
    ]);

    renderWithProviders(<PortfolioTable />);

    expect(screen.getByText('-0.50R')).toBeInTheDocument();
    expect(screen.getByTitle(t('positions.rFxAdjustedTooltip'))).toBeInTheDocument();
  });
});

describe('PortfolioTable symbol analysis', () => {
  it('dismisses pending actions before reverse Tab reaches Fill Order and keeps its dialog independent', async () => {
    positionsMock.mockReturnValue([]);
    const order: Order = {
      orderId: 'ORDER-QQQ', ticker: 'QQQ', status: 'pending', orderType: 'BUY_LIMIT',
      quantity: 1, limitPrice: 100, stopPrice: 90, orderDate: '2026-01-01', filledDate: '',
      entryPrice: 100, notes: '', orderKind: 'entry', parentOrderId: null, positionId: null,
      tif: 'GTC', quoteCurrency: 'USD',
    };
    ordersMock.mockReturnValue([order]);
    renderWithProviders(<PortfolioTable />);
    const label = `${t('workspacePage.panels.portfolio.columns.actions')} QQQ`;
    const trigger = screen.getByRole('button', { name: label });
    const fill = screen.getByRole('button', { name: t('common.actions.fillOrder') });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: t('common.actions.cancel') })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(trigger).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(fill).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(fill).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: t('order.fillModal.title', { ticker: 'QQQ' }) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('modal.closeAria') })).toHaveFocus();
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(fill).toHaveFocus();
  });

  it('opens labelled row actions with the keyboard and returns focus after analysis', async () => {
    positionsMock.mockReturnValue([makePosition()]);
    renderWithProviders(<PortfolioTable />);
    const trigger = screen.getByRole('button', {
      name: `${t('workspacePage.panels.portfolio.columns.actions')} TEST`,
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: t('workspacePage.panels.portfolio.analyze') })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('group', { name: trigger.getAttribute('aria-label')! })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('modal.closeAria') })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('passes the computed candidate to the modal order panel', async () => {
    positionsMock.mockReturnValue([makePosition()]);
    renderWithProviders(<PortfolioTable />);

    await userEvent.click(screen.getByRole('button', {
      name: `${t('workspacePage.panels.portfolio.columns.actions')} TEST`,
    }));
    await userEvent.click(screen.getByRole('button', { name: t('workspacePage.panels.portfolio.analyze') }));

    expect(screen.getByTestId('modal-order-candidate')).toHaveTextContent('TEST');
  });
});
