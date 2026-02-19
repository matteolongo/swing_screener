import { useMemo, useState } from 'react';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { useClosePositionMutation, useOrders, usePositions, useUpdateStopMutation } from '@/features/portfolio/hooks';
import { type Order } from '@/features/portfolio/types';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface PortfolioRow {
  id: string;
  ticker: string;
  status: 'open' | 'pending';
  pnl: number | null;
  pnlPercent: number | null;
  entryPrice: number | null;
  currentPrice: number | null;
  stopLoss: number | null;
  target: number | null;
  shares: number | null;
  position: PositionWithMetrics | null;
}

function formatOptionalCurrency(value: number | null): string {
  return value == null ? t('common.placeholders.dash') : formatCurrency(value);
}

export default function PortfolioTable() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);

  const positionsQuery = usePositions('open');
  const ordersQuery = useOrders('pending');
  const positions = positionsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const isLoading = positionsQuery.isLoading || ordersQuery.isLoading;
  const isError = positionsQuery.isError || ordersQuery.isError;

  const [selectedPosition, setSelectedPosition] = useState<PositionWithMetrics | null>(null);
  const [showUpdateStopModal, setShowUpdateStopModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const updateStopMutation = useUpdateStopMutation(() => {
    setShowUpdateStopModal(false);
    setSelectedPosition(null);
  });
  const closePositionMutation = useClosePositionMutation(() => {
    setShowCloseModal(false);
    setSelectedPosition(null);
  });

  const rows = useMemo<PortfolioRow[]>(() => {
    const byPositionId = new Map<string, { stopOrder?: Order; targetOrder?: Order }>();
    const standaloneOrders: Order[] = [];

    for (const order of orders) {
      if (!order.positionId) {
        standaloneOrders.push(order);
        continue;
      }
      const existing = byPositionId.get(order.positionId) ?? {};
      if (order.orderKind === 'stop') {
        existing.stopOrder = order;
      }
      if (order.orderKind === 'take_profit') {
        existing.targetOrder = order;
      }
      byPositionId.set(order.positionId, existing);
    }

    const positionRows: PortfolioRow[] = positions.map((position) => {
      const linked = position.positionId ? byPositionId.get(position.positionId) : undefined;
      return {
        id: position.positionId ?? `open-${position.ticker}`,
        ticker: position.ticker,
        status: 'open',
        pnl: position.pnl,
        pnlPercent: position.pnlPercent,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice ?? position.entryPrice,
        stopLoss: linked?.stopOrder?.stopPrice ?? position.stopPrice,
        target: linked?.targetOrder?.limitPrice ?? null,
        shares: position.shares,
        position,
      };
    });

    const standaloneRows: PortfolioRow[] = standaloneOrders.map((order) => ({
      id: `pending-${order.orderId}`,
      ticker: order.ticker,
      status: 'pending',
      pnl: null,
      pnlPercent: null,
      entryPrice: order.limitPrice ?? order.entryPrice ?? null,
      currentPrice: null,
      stopLoss: order.stopPrice ?? null,
      target: order.orderKind === 'take_profit' ? order.limitPrice ?? null : null,
      shares: order.quantity,
      position: null,
    }));

    return [...positionRows, ...standaloneRows];
  }, [orders, positions]);

  const columns: DataTableColumn<PortfolioRow>[] = [
    {
      key: 'ticker',
      header: t('workspacePage.panels.portfolio.columns.symbol'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{row.ticker}</span>
          <Badge variant={row.status === 'open' ? 'success' : 'warning'}>{row.status}</Badge>
        </div>
      ),
    },
    {
      key: 'pnl',
      header: t('workspacePage.panels.portfolio.columns.pnl'),
      align: 'right',
      render: (row) => {
        if (row.pnl == null || row.pnlPercent == null) return t('common.placeholders.dash');
        const isPositive = row.pnl >= 0;
        return (
          <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {isPositive ? '+' : ''}
            {formatCurrency(row.pnl)} ({formatPercent(row.pnlPercent)})
          </span>
        );
      },
    },
    {
      key: 'entry',
      header: t('workspacePage.panels.portfolio.columns.entry'),
      align: 'right',
      render: (row) => formatOptionalCurrency(row.entryPrice),
    },
    {
      key: 'current',
      header: t('workspacePage.panels.portfolio.columns.current'),
      align: 'right',
      render: (row) => formatOptionalCurrency(row.currentPrice),
    },
    {
      key: 'stop',
      header: t('workspacePage.panels.portfolio.columns.stop'),
      align: 'right',
      render: (row) => formatOptionalCurrency(row.stopLoss),
    },
    {
      key: 'target',
      header: t('workspacePage.panels.portfolio.columns.target'),
      align: 'right',
      render: (row) => formatOptionalCurrency(row.target),
    },
    {
      key: 'actions',
      header: t('workspacePage.panels.portfolio.columns.actions'),
      align: 'right',
      render: (row) =>
        row.position?.positionId ? (
          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setSelectedPosition(row.position);
                setShowUpdateStopModal(true);
              }}
            >
              {t('positionsPage.updateStop')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedPosition(row.position);
                setShowCloseModal(true);
              }}
            >
              {t('positionsPage.closePosition')}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-gray-500">{t('workspacePage.panels.portfolio.pendingOnly')}</span>
        ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.id}
        loading={isLoading}
        empty={!isLoading && rows.length === 0}
        emptyMessage={t('workspacePage.panels.portfolio.empty')}
        error={isError ? t('workspacePage.panels.portfolio.loadError') : undefined}
        rowClassName={(row) => {
          const isSelected = selectedTicker?.toUpperCase() === row.ticker.toUpperCase();
          const base =
            'border-t transition-colors cursor-pointer ' +
            (isSelected
              ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800');
          return base;
        }}
        onRowClick={(row) => setSelectedTicker(row.ticker)}
      />

      {showUpdateStopModal && selectedPosition ? (
        <UpdateStopModalForm
          position={selectedPosition}
          onClose={() => {
            setShowUpdateStopModal(false);
            setSelectedPosition(null);
          }}
          onSubmit={(request) =>
            updateStopMutation.mutate({
              positionId: selectedPosition.positionId!,
              request,
            })
          }
          isLoading={updateStopMutation.isPending}
          error={updateStopMutation.error?.message}
        />
      ) : null}

      {showCloseModal && selectedPosition ? (
        <ClosePositionModalForm
          position={selectedPosition}
          onClose={() => {
            setShowCloseModal(false);
            setSelectedPosition(null);
          }}
          onSubmit={(request) =>
            closePositionMutation.mutate({
              positionId: selectedPosition.positionId!,
              request,
            })
          }
          isLoading={closePositionMutation.isPending}
          error={closePositionMutation.error?.message}
        />
      ) : null}
    </>
  );
}
