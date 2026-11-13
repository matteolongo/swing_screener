import { type DataTableColumn } from '@/components/common/DataTable';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import ActionMenu from '@/components/common/ActionMenu';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { type Order } from '@/features/portfolio/types';
import { getSignColorClass } from '@/utils/formatters';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import {
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
      header: t('workspacePage.panels.portfolio.columns.netPnl'),
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
      header: t('workspacePage.panels.portfolio.columns.prices'),
      render: (row) => {
        const priceSource = row.position?.priceSource;
        // Always show the price the metrics used when it is not a live quote,
        // even if it equals the entry price (an unpriced position reads flat).
        const showNow = row.currentPrice != null
          && (row.currentPrice !== row.entryPrice || (priceSource != null && priceSource !== 'live'));
        const flagged = priceSource === 'cached' || priceSource === 'entry';
        return (
          <div className="text-xs space-y-0.5 font-mono">
            <div className="flex gap-1 text-muted">
              <span>{t('workspacePage.panels.portfolio.columns.entry')}</span>
              <span className="text-foreground">{formatOptionalCurrency(row.entryPrice)}</span>
            </div>
            {showNow ? (
              <div className="flex gap-1 text-muted items-center">
                <span>{t('workspacePage.panels.portfolio.columns.now')}</span>
                <span className={cn('text-foreground', flagged && 'text-warning')}>
                  {formatOptionalCurrency(row.currentPrice)}
                </span>
                {flagged && (
                  <span
                    className="text-warning text-[10px] leading-none"
                    title={t(priceSource === 'entry' ? 'positions.priceUnavailableTooltip' : 'positions.priceStaleTooltip')}
                  >
                    {t(priceSource === 'entry' ? 'positions.priceUnavailable' : 'positions.priceStale')}
                  </span>
                )}
              </div>
            ) : null}
            <div className="flex gap-1 text-muted">
              <span>{t('workspacePage.panels.portfolio.columns.stopShort')}</span>
              {row.position?.rUsesInitialRisk && row.stopLoss != null && row.entryPrice != null && Math.abs(row.stopLoss - row.entryPrice) < 0.01 ? (
                <span
                  className="text-muted"
                  title={t('workspacePage.panels.portfolio.columns.breakEvenTitle', { price: formatOptionalCurrency(row.stopLoss) })}
                >
                  {t('workspacePage.panels.portfolio.columns.breakEven')}
                </span>
              ) : (
                <span className="text-danger">{formatOptionalCurrency(row.stopLoss)}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'shares',
      header: t('workspacePage.panels.portfolio.columns.shares'),
      align: 'right',
      render: (row) => (
        <span className="text-sm font-mono">{row.shares ?? '—'}</span>
      ),
    },
    {
      key: 'r',
      header: t('workspacePage.panels.portfolio.columns.r'),
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
              <ActionMenu
                label={`${t('workspacePage.panels.portfolio.columns.actions')} ${row.ticker}`}
                items={[{ label: t('workspacePage.panels.portfolio.analyze'), onClick: () => actions.onAnalyze(row) }]}
              />
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
              <ActionMenu
                label={`${t('workspacePage.panels.portfolio.columns.actions')} ${row.ticker}`}
                items={[{
                  label: actions.cancelPending ? t('common.table.loading') : t('common.actions.cancel'),
                  className: 'text-danger',
                  onClick: () => {
                    if (!row.order) return;
                    actions.onCancelOrder(row.order);
                  },
                }]}
              />
            </div>
          );
        }
        return <span className="text-xs text-muted">{t('workspacePage.panels.portfolio.pendingOnly')}</span>;
      },
    },
  ];
}
