import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import FillOrderModalForm from '@/components/domain/orders/FillOrderModalForm';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import PartialCloseModalForm from '@/components/domain/positions/PartialCloseModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import WorkspaceSymbolModal from '@/components/domain/workspace/WorkspaceSymbolModal';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import {
  useCancelOrderMutation,
  useClosePositionMutation,
  usePartialClosePositionMutation,
  useFillOrderMutation,
  useOrders,
  usePositions,
  usePositionStopPreviewQuery,
  useUpdateStopMutation,
} from '@/features/portfolio/hooks';
import { type Order } from '@/features/portfolio/types';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { formatCurrency, formatPercent, getSignColorClass } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface PortfolioRow {
  id: string;
  ticker: string;
  status: 'open' | 'pending';
  netPnl: number | null;
  netPnlPercent: number | null;
  entryPrice: number | null;
  currentPrice: number | null;
  stopLoss: number | null;
  shares: number | null;
  position: PositionWithMetrics | null;
  order: Order | null;
}

function formatPnlValue(pnl: number | null, pnlPercent: number | null): string {
  if (pnl == null || pnlPercent == null) return t('common.placeholders.dash');
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}${formatCurrency(pnl)} (${formatPercent(pnlPercent)})`;
}

function formatOptionalCurrency(value: number | null): string {
  return value == null ? t('common.placeholders.dash') : formatCurrency(value);
}

function TimeStopBadge({ position }: { position: PositionWithMetrics | null }) {
  if (!position?.timeStopWarning) return null;
  const label = t('bookPage.positions.timeStopBadge', {
    days: String(position.daysOpen),
    r: `${position.rNow >= 0 ? '+' : ''}${position.rNow.toFixed(2)}`,
  });
  return (
    <span
      className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      title={t('bookPage.positions.timeStopWarning')}
    >
      {label}
    </span>
  );
}

/** Compact actions dropdown using native <details> */
function ActionsDropdown({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative inline-block">
      <summary className="list-none cursor-pointer rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 select-none">
        ⋯
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-md p-1">
        {children}
      </div>
    </details>
  );
}

function DropdownItem({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        // close the details parent
        const details = (e.target as HTMLElement).closest('details');
        if (details) (details as HTMLDetailsElement).open = false;
        onClick();
      }}
      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${className ?? ''}`}
    >
      {label}
    </button>
  );
}

interface StopPreviewPanelProps {
  positionId: string;
  ticker: string;
  price: number | null;
  onClose: () => void;
}

function StopPreviewPanel({ positionId, ticker, price, onClose }: StopPreviewPanelProps) {
  const { data, isLoading, error } = usePositionStopPreviewQuery(positionId, price, true);

  let message = '';
  let messageClass = 'text-gray-700 dark:text-gray-300';

  if (data) {
    switch (data.action) {
      case 'MOVE_STOP_UP':
        message = `${t('workspacePage.panels.portfolio.intradayPreview.stopCanRaise')} ${formatCurrency(data.stopSuggested)}`;
        messageClass = 'text-emerald-700 dark:text-emerald-400 font-semibold';
        break;
      case 'CLOSE_STOP_HIT':
        message = t('workspacePage.panels.portfolio.intradayPreview.stopHit');
        messageClass = 'text-rose-700 dark:text-rose-400 font-semibold';
        break;
      case 'CLOSE_EXIT_SIGNAL':
        message = t('workspacePage.panels.portfolio.intradayPreview.exitSignal');
        messageClass = 'text-amber-700 dark:text-amber-400 font-semibold';
        break;
      case 'CLOSE_TIME_EXIT':
        message = t('workspacePage.panels.portfolio.intradayPreview.timeExit');
        messageClass = 'text-amber-700 dark:text-amber-400 font-semibold';
        break;
      default:
        message = t('workspacePage.panels.portfolio.intradayPreview.noChange');
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-blue-900 dark:text-blue-200">
          {ticker} — {t('workspacePage.panels.portfolio.intradayPreview.checkLive')}
          {price != null && (
            <span className="ml-1 font-mono text-xs text-blue-700 dark:text-blue-400">
              @ {formatCurrency(price)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 text-xs"
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>
      {isLoading && (
        <p className="mt-1 text-blue-600 dark:text-blue-400 text-xs">
          {t('workspacePage.panels.portfolio.intradayPreview.loading')}
        </p>
      )}
      {error && (
        <p className="mt-1 text-rose-600 dark:text-rose-400 text-xs">{error.message}</p>
      )}
      {data && !isLoading && (
        <div className="mt-1 space-y-0.5">
          <p className={messageClass}>{message}</p>
          {data.reason && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{data.reason}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            R: {data.rNow >= 0 ? '+' : ''}{data.rNow.toFixed(2)} · live {formatCurrency(data.last)}
          </p>
          {data.exhaustionScore != null && data.exhaustionLabel != null && (
            <p className={`text-xs font-medium ${
              data.exhaustionLabel === 'exit' ? 'text-rose-700 dark:text-rose-400' :
              data.exhaustionLabel === 'watch' ? 'text-amber-700 dark:text-amber-400' :
              'text-emerald-700 dark:text-emerald-400'
            }`}>
              {data.exhaustionLabel === 'exit' ? '🔴' : data.exhaustionLabel === 'watch' ? '🟡' : '🟢'}{' '}
              {t('workspacePage.panels.portfolio.intradayPreview.exhaustion', {
                label: data.exhaustionLabel,
                score: data.exhaustionScore.toFixed(1),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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

  const [analyzeTarget, setAnalyzeTarget] = useState<{ ticker: string; position: PositionWithMetrics | null } | null>(null);

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

  const columns: DataTableColumn<PortfolioRow>[] = [
    {
      key: 'ticker',
      header: t('workspacePage.panels.portfolio.columns.symbol'),
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm">{row.ticker}</span>
          <Badge variant={row.status === 'open' ? 'success' : 'warning'} >{row.status}</Badge>
          <TimeStopBadge position={row.position} />
        </div>
      ),
    },
    {
      key: 'netPnl',
      header: 'Net P&L',
      align: 'right',
      render: (row) => {
        if (row.netPnl == null) return <span className="text-gray-400 text-xs">—</span>;
        return (
          <span className={`font-semibold text-sm ${getSignColorClass(row.netPnl)}`}>
            {formatPnlValue(row.netPnl, row.netPnlPercent)}
          </span>
        );
      },
    },
    {
      key: 'entry',
      header: 'Prices',
      render: (row) => (
        <div className="text-xs space-y-0.5 font-mono">
          <div className="flex gap-1 text-gray-500">
            <span>Entry</span>
            <span className="text-gray-900 dark:text-gray-100">{formatOptionalCurrency(row.entryPrice)}</span>
          </div>
          {row.currentPrice != null && row.currentPrice !== row.entryPrice ? (
            <div className="flex gap-1 text-gray-500">
              <span>Now</span>
              <span className="text-gray-900 dark:text-gray-100">{formatOptionalCurrency(row.currentPrice)}</span>
            </div>
          ) : null}
          <div className="flex gap-1 text-gray-500">
            <span>Stop</span>
            <span className="text-rose-700 dark:text-rose-400">{formatOptionalCurrency(row.stopLoss)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'shares',
      header: 'Shares',
      align: 'right',
      render: (row) => (
        <span className="text-sm font-mono">{row.shares ?? '—'}</span>
      ),
    },
    {
      key: 'r',
      header: 'R',
      align: 'right' as const,
      render: (row) => {
        if (!row.position) return <span className="text-gray-400 text-xs">—</span>;
        const { rNow, rFxAdjusted } = row.position;
        const rSign = rNow >= 0 ? '+' : '';
        const rLabel = `${rSign}${rNow.toFixed(2)}R`;
        if (rFxAdjusted == null) {
          return <span className="text-sm font-mono">{rLabel}</span>;
        }
        const fxSign = rFxAdjusted >= 0 ? '+' : '';
        const fxLabel = `${fxSign}${rFxAdjusted.toFixed(2)}R`;
        return (
          <div className="text-right font-mono">
            <div className="text-sm">{rLabel}</div>
            <div
              className="text-xs text-gray-500 dark:text-gray-400"
              title={t('positions.rFxAdjustedTooltip')}
            >
              {t('positions.rFxAdjusted')}: {fxLabel}
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => {
        if (row.position?.positionId) {
          return (
            <div className="flex justify-end items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPreviewPositionId(row.position!.positionId!);
                  setPreviewTicker(row.ticker);
                  setHypotheticalPriceInput('');
                  setTimeout(() => previewInputRef.current?.focus(), 50);
                }}
                title={t('workspacePage.panels.portfolio.intradayPreview.checkLive')}
              >
                {t('workspacePage.panels.portfolio.intradayPreview.checkLive')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setSelectedPosition(row.position);
                  setShowUpdateStopModal(true);
                }}
                title={t('positionsPage.updateStop')}
              >
                {t('positionsPage.updateStop')}
              </Button>
              <ActionsDropdown>
                <DropdownItem
                  label={t('workspacePage.panels.portfolio.analyze')}
                  onClick={() => setAnalyzeTarget({ ticker: row.ticker, position: row.position })}
                />
                <DropdownItem
                  label={t('workspacePage.panels.portfolio.addOnEntry')}
                  onClick={() => {
                    setSelectedTicker(row.ticker, 'portfolio');
                    setAnalysisTab('order');
                  }}
                />
                <DropdownItem
                  label={t('positions.partialCloseModal.submit')}
                  onClick={() => {
                    setSelectedPosition(row.position);
                    setShowPartialCloseModal(true);
                  }}
                />
                <DropdownItem
                  label={t('positionsPage.closePosition')}
                  className="text-rose-700 dark:text-rose-400"
                  onClick={() => {
                    setSelectedPosition(row.position);
                    setShowCloseModal(true);
                  }}
                />
              </ActionsDropdown>
            </div>
          );
        }
        if (row.order) {
          return (
            <div className="flex justify-end items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="primary"
                disabled={cancelOrderMutation.isPending || fillOrderMutation.isPending}
                onClick={() => {
                  if (!row.order) return;
                  setSelectedPendingOrder(row.order);
                  setShowFillOrderModal(true);
                }}
              >
                {t('common.actions.fillOrder')}
              </Button>
              <ActionsDropdown>
                <DropdownItem
                  label={cancelOrderMutation.isPending ? t('common.table.loading') : t('common.actions.cancel')}
                  className="text-rose-700 dark:text-rose-400"
                  onClick={() => {
                    if (!row.order) return;
                    if (!window.confirm(t('ordersPage.confirmCancel'))) return;
                    cancelOrderMutation.mutate(row.order.orderId);
                  }}
                />
              </ActionsDropdown>
            </div>
          );
        }
        return <span className="text-xs text-gray-500">{t('workspacePage.panels.portfolio.pendingOnly')}</span>;
      },
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
        wrapperClassName="xl:max-h-[420px] overflow-auto rounded-md bg-white"
        tableClassName="text-sm"
        rowClassName={(row) => {
          const isSelected = selectedTicker?.toUpperCase() === row.ticker.toUpperCase();
          return (
            'border-t transition-colors cursor-pointer ' +
            (isSelected
              ? 'bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800')
          );
        }}
        onRowClick={(row) => setSelectedTicker(row.ticker)}
      />

      {previewPositionId && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <label htmlFor="hypothetical-price" className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
              className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-xs font-mono"
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

      {analyzeTarget && (
        <WorkspaceSymbolModal
          ticker={analyzeTarget.ticker}
          position={analyzeTarget.position}
          onBack={() => setAnalyzeTarget(null)}
        />
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
