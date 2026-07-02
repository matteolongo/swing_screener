import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DataTable from '@/components/common/DataTable';
import FillOrderModalForm from '@/components/domain/orders/FillOrderModalForm';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import PartialCloseModalForm from '@/components/domain/positions/PartialCloseModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import {
  useCancelOrderMutation,
  useClosePositionMutation,
  usePartialClosePositionMutation,
  useFillOrderMutation,
  useOrders,
  usePositions,
  useUpdateStopMutation,
} from '@/features/portfolio/hooks';
import { type Order } from '@/features/portfolio/types';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { StopPreviewPanel, type PortfolioRow } from './PortfolioTableParts';
import { buildPortfolioColumns } from './portfolioColumns';

export default function PortfolioTable() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const location = useLocation();

  const positionsQuery = usePositions('open');
  const ordersQuery = useOrders('pending');
  const positions = positionsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const isLoading = positionsQuery.isLoading || ordersQuery.isLoading;
  const isReady = positionsQuery.isFetched && ordersQuery.isFetched;
  const isError = positionsQuery.isError || ordersQuery.isError;

  const [selectedPosition, setSelectedPosition] = useState<PositionWithMetrics | null>(null);
  const [selectedPendingOrder, setSelectedPendingOrder] = useState<Order | null>(null);
  const [showUpdateStopModal, setShowUpdateStopModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPartialCloseModal, setShowPartialCloseModal] = useState(false);
  const [showFillOrderModal, setShowFillOrderModal] = useState(false);

  const [previewPositionId, setPreviewPositionId] = useState<string | null>(null);
  const [previewTicker, setPreviewTicker] = useState<string>('');
  const [hypotheticalPriceInput, setHypotheticalPriceInput] = useState<string>('');
  const hypotheticalPrice = hypotheticalPriceInput !== '' ? parseFloat(hypotheticalPriceInput) : null;
  const priceForQuery = hypotheticalPrice != null && hypotheticalPrice > 0 ? hypotheticalPrice : null;
  const previewInputRef = useRef<HTMLInputElement>(null);

  const updateStopMutation = useUpdateStopMutation(() => {
    setShowUpdateStopModal(false);
    setSelectedPosition(null);
  });
  const closePositionMutation = useClosePositionMutation(() => {
    setShowCloseModal(false);
    setSelectedPosition(null);
  });
  const partialClosePositionMutation = usePartialClosePositionMutation(() => {
    setShowPartialCloseModal(false);
    setSelectedPosition(null);
  });
  const fillOrderMutation = useFillOrderMutation(() => {
    setShowFillOrderModal(false);
    setSelectedPendingOrder(null);
  });
  const cancelOrderMutation = useCancelOrderMutation();

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
      } else if (order.orderKind === 'take_profit') {
        existing.targetOrder = order;
      } else {
        standaloneOrders.push(order);
      }
      byPositionId.set(order.positionId, existing);
    }

    const positionRows: PortfolioRow[] = positions.map((position) => {
      const linked = position.positionId ? byPositionId.get(position.positionId) : undefined;
      const effectiveCurrentPrice = position.currentPrice ?? position.entryPrice;
      return {
        id: position.positionId ?? `open-${position.ticker}`,
        ticker: position.ticker,
        status: 'open',
        netPnl: position.pnl,
        netPnlPercent: position.pnlPercent,
        entryPrice: position.entryPrice,
        currentPrice: effectiveCurrentPrice,
        stopLoss: linked?.stopOrder?.stopPrice ?? position.stopPrice,
        shares: position.shares,
        position,
        order: null,
      };
    });

    const standaloneRows: PortfolioRow[] = standaloneOrders.map((order) => ({
      id: `pending-${order.orderId}`,
      ticker: order.ticker,
      status: 'pending',
      netPnl: null,
      netPnlPercent: null,
      entryPrice: order.limitPrice ?? order.entryPrice ?? null,
      currentPrice: null,
      stopLoss: order.stopPrice ?? null,
      shares: order.quantity,
      position: null,
      order,
    }));

    return [...positionRows, ...standaloneRows];
  }, [orders, positions]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const action = searchParams.get('portfolioAction');
    if (!action || !isReady) return;

    const tickerParam = searchParams.get('ticker');
    const positionId = searchParams.get('positionId');
    const orderId = searchParams.get('orderId');
    const normalizedTicker = tickerParam?.trim().toUpperCase();

    const clearPortfolioIntent = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('portfolioAction');
      url.searchParams.delete('ticker');
      url.searchParams.delete('positionId');
      url.searchParams.delete('orderId');
      const nextSearch = url.searchParams.toString();
      const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    };

    if (tickerParam) {
      setSelectedTicker(tickerParam);
    }

    if (action === 'update-stop' || action === 'close-position') {
      const matchedPosition = rows.find((row) => {
        if (!row.position?.positionId) return false;
        if (positionId) return row.position.positionId === positionId;
        return normalizedTicker ? row.ticker.toUpperCase() === normalizedTicker : false;
      })?.position;

      if (!matchedPosition) { clearPortfolioIntent(); return; }

      setSelectedPosition(matchedPosition);
      setSelectedPendingOrder(null);
      setShowFillOrderModal(false);
      if (action === 'update-stop') {
        setShowCloseModal(false);
        setShowUpdateStopModal(true);
      } else {
        setShowUpdateStopModal(false);
        setShowCloseModal(true);
      }
      clearPortfolioIntent();
      return;
    }

    if (action === 'fill-order') {
      const matchedOrder = rows.find((row) => {
        if (!row.order?.orderId) return false;
        if (orderId) return row.order.orderId === orderId;
        return normalizedTicker ? row.ticker.toUpperCase() === normalizedTicker : false;
      })?.order;

      if (!matchedOrder) { clearPortfolioIntent(); return; }

      setSelectedPendingOrder(matchedOrder);
      setSelectedPosition(null);
      setShowUpdateStopModal(false);
      setShowCloseModal(false);
      setShowFillOrderModal(true);
      clearPortfolioIntent();
      return;
    }

    clearPortfolioIntent();
  }, [isReady, location, rows, setSelectedTicker]);

  const columns = useMemo(
    () =>
      buildPortfolioColumns({
        onCheckLive: (row) => {
          setPreviewPositionId(row.position!.positionId!);
          setPreviewTicker(row.ticker);
          setHypotheticalPriceInput('');
          setTimeout(() => previewInputRef.current?.focus(), 50);
        },
        onUpdateStop: (position) => {
          setSelectedPosition(position);
          setShowUpdateStopModal(true);
        },
        onAnalyze: (row) => setSelectedTicker(row.ticker, 'portfolio'),
        onAddOnEntry: (ticker) => {
          setSelectedTicker(ticker, 'portfolio');
          setAnalysisTab('order');
        },
        onPartialClose: (position) => {
          setSelectedPosition(position);
          setShowPartialCloseModal(true);
        },
        onClosePosition: (position) => {
          setSelectedPosition(position);
          setShowCloseModal(true);
        },
        onFillOrder: (order) => {
          setSelectedPendingOrder(order);
          setShowFillOrderModal(true);
        },
        onCancelOrder: (order) => {
          if (!window.confirm(t('ordersPage.confirmCancel'))) return;
          cancelOrderMutation.mutate(order.orderId);
        },
        cancelPending: cancelOrderMutation.isPending,
        fillPending: fillOrderMutation.isPending,
      }),
    [setAnalysisTab, setSelectedTicker, cancelOrderMutation, fillOrderMutation.isPending],
  );

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
        wrapperClassName="xl:max-h-[420px] overflow-auto rounded-md bg-surface"
        tableClassName="text-sm"
        rowClassName={(row) => {
          const isSelected = selectedTicker?.toUpperCase() === row.ticker.toUpperCase();
          return (
            'border-t transition-colors cursor-pointer ' +
            (isSelected
              ? 'bg-primary/10 hover:bg-primary/10'
              : 'hover:bg-foreground/5')
          );
        }}
        onRowClick={(row) => setSelectedTicker(row.ticker)}
      />

      {previewPositionId && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <label htmlFor="hypothetical-price" className="text-xs text-muted whitespace-nowrap">
              {t('workspacePage.panels.portfolio.intradayPreview.hypotheticalPrice')}
            </label>
            <input
              id="hypothetical-price"
              ref={previewInputRef}
              type="number"
              min="0.01"
              step="0.01"
              value={hypotheticalPriceInput}
              onChange={(e) => setHypotheticalPriceInput(e.target.value)}
              placeholder="live"
              className="w-24 rounded border border-border bg-surface px-2 py-0.5 text-xs font-mono"
            />
          </div>
          <StopPreviewPanel
            positionId={previewPositionId}
            ticker={previewTicker}
            price={priceForQuery}
            onClose={() => { setPreviewPositionId(null); setHypotheticalPriceInput(''); }}
          />
        </div>
      )}

      {showUpdateStopModal && selectedPosition ? (
        <UpdateStopModalForm
          position={selectedPosition}
          onClose={() => { setShowUpdateStopModal(false); setSelectedPosition(null); }}
          onSubmit={(request) =>
            updateStopMutation.mutate({ positionId: selectedPosition.positionId!, request })
          }
          isLoading={updateStopMutation.isPending}
          error={updateStopMutation.error?.message}
        />
      ) : null}

      {showCloseModal && selectedPosition ? (
        <ClosePositionModalForm
          position={selectedPosition}
          onClose={() => { setShowCloseModal(false); setSelectedPosition(null); }}
          onSubmit={(request) =>
            closePositionMutation.mutate({ positionId: selectedPosition.positionId!, request })
          }
          isLoading={closePositionMutation.isPending}
          error={closePositionMutation.error?.message}
        />
      ) : null}

      {showPartialCloseModal && selectedPosition ? (
        <PartialCloseModalForm
          position={selectedPosition}
          onClose={() => { setShowPartialCloseModal(false); setSelectedPosition(null); }}
          onSubmit={(request) =>
            partialClosePositionMutation.mutate({ positionId: selectedPosition.positionId!, request })
          }
          isLoading={partialClosePositionMutation.isPending}
          error={partialClosePositionMutation.error?.message}
        />
      ) : null}

      {showFillOrderModal && selectedPendingOrder ? (
        <FillOrderModalForm
          order={selectedPendingOrder}
          hasOpenPositionForTicker={positions.some(
            (p) => p.ticker?.trim().toUpperCase() === selectedPendingOrder.ticker?.trim().toUpperCase()
          )}
          onClose={() => { setShowFillOrderModal(false); setSelectedPendingOrder(null); }}
          onSubmit={(request) =>
            fillOrderMutation.mutate({ orderId: selectedPendingOrder.orderId, request })
          }
          isLoading={fillOrderMutation.isPending}
          error={fillOrderMutation.error?.message}
        />
      ) : null}
    </>
  );
}
