import { type DataTableColumn } from '@/components/common/DataTable';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { type Order } from '@/features/portfolio/types';
import { getSignColorClass } from '@/utils/formatters';
import { t } from '@/i18n/t';
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
            <div className="flex gap-1 text-muted">
              <span>Now</span>
              <span className="text-foreground">{formatOptionalCurrency(row.currentPrice)}</span>
            </div>
          ) : null}
          <div className="flex gap-1 text-muted">
            <span>Stop</span>
            <span className="text-danger">{formatOptionalCurrency(row.stopLoss)}</span>
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
              className="text-xs text-muted"
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
