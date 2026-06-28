import { type DataTableColumn } from '@/components/common/DataTable';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { type Order } from '@/features/portfolio/types';
import { getSignColorClass } from '@/utils/formatters';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import {
  ActionsDropdown,
  DropdownItem,
  TimeStopBadge,
  formatOptionalCurrency,
  formatPnlValue,
  type PortfolioRow,
} from './PortfolioTableParts';

export interface PortfolioColumnActions {
  onCheckLive: (row: PortfolioRow) => void;
  onUpdateStop: (position: PositionWithMetrics) => void;
  onAnalyze: (row: PortfolioRow) => void;
  onAddOnEntry: (ticker: string) => void;
  onPartialClose: (position: PositionWithMetrics) => void;
  onClosePosition: (position: PositionWithMetrics) => void;
  onFillOrder: (order: Order) => void;
  onCancelOrder: (order: Order) => void;
  cancelPending: boolean;
  fillPending: boolean;
}

export function buildPortfolioColumns(actions: PortfolioColumnActions): DataTableColumn<PortfolioRow>[] {
  return [
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
        if (row.netPnl == null) return <span className="text-muted text-xs">—</span>;
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
          <div className="flex gap-1 text-muted">
            <span>Entry</span>
            <span className="text-foreground">{formatOptionalCurrency(row.entryPrice)}</span>
          </div>
          {row.currentPrice != null && row.currentPrice !== row.entryPrice ? (
            <div className="flex gap-1 text-muted items-center">
              <span>Now</span>
              <span className={cn('text-foreground', row.position?.priceSource !== 'live' && 'text-warning')}>
                {formatOptionalCurrency(row.currentPrice)}
              </span>
              {row.position?.priceSource !== 'live' && (
                <span
                  className="text-warning text-[10px] leading-none"
                  title={t('positions.priceStaleTooltip')}
                >
                  {t('positions.priceStale')}
                </span>
              )}
            </div>
          ) : null}
          <div className="flex gap-1 text-muted">
            <span>Stop</span>
            {row.position?.rUsesInitialRisk && row.stopLoss != null && row.entryPrice != null && Math.abs(row.stopLoss - row.entryPrice) < 0.01 ? (
              <span className="text-muted" title={`Break-even stop at ${formatOptionalCurrency(row.stopLoss)}`}>B/E</span>
            ) : (
              <span className="text-danger">{formatOptionalCurrency(row.stopLoss)}</span>
            )}
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
        if (!row.position) return <span className="text-muted text-xs">—</span>;
        const { rNow, rFxAdjusted, rUsesInitialRisk } = row.position;
        const rSign = rNow >= 0 ? '+' : '';
        const rLabel = `${rSign}${rNow.toFixed(2)}R`;
        if (rFxAdjusted == null && !rUsesInitialRisk) {
          return <span className="text-sm font-mono">{rLabel}</span>;
        }
        return (
          <div className="text-right font-mono">
            <div className="text-sm">{rLabel}</div>
            {rFxAdjusted != null && (
              <div
                className="text-xs text-muted"
                title={t('positions.rFxAdjustedTooltip')}
              >
                {t('positions.rFxAdjusted')}: {`${rFxAdjusted >= 0 ? '+' : ''}${rFxAdjusted.toFixed(2)}R`}
              </div>
            )}
            {rUsesInitialRisk && (
              <div
                className="text-xs text-muted"
                title={t('positions.rInitialRiskTooltip')}
              >
                {t('positions.rInitialRisk')}
              </div>
            )}
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
                onClick={() => actions.onCheckLive(row)}
                title={t('workspacePage.panels.portfolio.intradayPreview.checkLive')}
              >
                {t('workspacePage.panels.portfolio.intradayPreview.checkLive')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => actions.onUpdateStop(row.position!)}
                title={t('positionsPage.updateStop')}
              >
                {t('positionsPage.updateStop')}
              </Button>
              <ActionsDropdown>
                <DropdownItem
                  label={t('workspacePage.panels.portfolio.analyze')}
                  onClick={() => actions.onAnalyze(row)}
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
                disabled={actions.cancelPending || actions.fillPending}
                onClick={() => {
                  if (!row.order) return;
                  actions.onFillOrder(row.order);
                }}
              >
                {t('common.actions.fillOrder')}
              </Button>
              <ActionsDropdown>
                <DropdownItem
                  label={actions.cancelPending ? t('common.table.loading') : t('common.actions.cancel')}
                  className="text-danger"
                  onClick={() => {
                    if (!row.order) return;
                    actions.onCancelOrder(row.order);
                  }}
                />
              </ActionsDropdown>
            </div>
          );
        }
        return <span className="text-xs text-muted">{t('workspacePage.panels.portfolio.pendingOnly')}</span>;
      },
    },
  ];
}
