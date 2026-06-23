import Card from '@/components/common/Card';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import RChip from '@/components/common/RChip';
import { StatCard } from '@/components/domain/analytics/AnalyticsCards';
import type { BacktestResult, BacktestTrade } from '@/features/backtest/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import {
  formatNumber,
  formatPrice,
  formatR,
  formatRatioAsPercent,
  getSignColorClass,
} from '@/utils/formatters';

function exitReasonLabel(reason: string): string {
  return t(`backtest.exitReason.${reason}` as MessageKey);
}

interface BacktestResultsProps {
  result: BacktestResult;
}

/**
 * R-distribution metric tiles + the per-trade ledger for one event-study run.
 * Shared by the Backtest page and the symbol analysis canvas tab.
 */
export default function BacktestResults({ result }: BacktestResultsProps) {
  const { metrics, trades } = result;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('backtest.results.title')}</h2>
        <p className="text-xs text-muted">
          {t('backtest.results.window', {
            count: metrics.nTrades,
            start: result.start,
            end: result.end,
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={t('backtest.metrics.expectancy')}
          value={formatR(metrics.expectancyR)}
          colorClass={getSignColorClass(metrics.expectancyR)}
        />
        <StatCard
          label={t('backtest.metrics.winRate')}
          value={formatRatioAsPercent(metrics.winRate)}
        />
        <StatCard
          label={t('backtest.metrics.profitFactor')}
          value={metrics.profitFactor == null ? '∞' : formatNumber(metrics.profitFactor, 2)}
        />
        <StatCard
          label={t('backtest.metrics.totalR')}
          value={formatR(metrics.totalR)}
          colorClass={getSignColorClass(metrics.totalR)}
        />
        <StatCard
          label={t('backtest.metrics.maxDrawdown')}
          value={`${formatNumber(metrics.maxDrawdownR, 2)}R`}
          colorClass="text-danger"
        />
        <StatCard label={t('backtest.metrics.trades')} value={String(metrics.nTrades)} />
      </div>

      <Card variant="bordered" className="p-0 overflow-hidden">
        <DataTable<BacktestTrade>
          rows={trades}
          getRowKey={(row, index) => `${row.ticker}-${row.entryDate}-${index}`}
          empty={trades.length === 0}
          emptyMessage={t('backtest.results.noTrades')}
          columns={tradeColumns()}
        />
      </Card>
    </section>
  );
}

function tradeColumns(): DataTableColumn<BacktestTrade>[] {
  return [
    { key: 'ticker', header: t('backtest.table.ticker'), render: (r) => r.ticker },
    { key: 'setup', header: t('backtest.table.setup'), render: (r) => r.setup },
    { key: 'entryDate', header: t('backtest.table.entryDate'), render: (r) => r.entryDate },
    {
      key: 'entryPrice',
      header: t('backtest.table.entryPrice'),
      align: 'right',
      render: (r) => formatPrice(r.entryPrice),
    },
    {
      key: 'initialStop',
      header: t('backtest.table.initialStop'),
      align: 'right',
      render: (r) => formatPrice(r.initialStop),
    },
    { key: 'exitDate', header: t('backtest.table.exitDate'), render: (r) => r.exitDate },
    {
      key: 'exitPrice',
      header: t('backtest.table.exitPrice'),
      align: 'right',
      render: (r) => formatPrice(r.exitPrice),
    },
    {
      key: 'exitReason',
      header: t('backtest.table.exitReason'),
      render: (r) => exitReasonLabel(r.exitReason),
    },
    {
      key: 'rMultiple',
      header: t('backtest.table.rMultiple'),
      align: 'right',
      render: (r) => <RChip value={r.rMultiple} />,
    },
    {
      key: 'barsHeld',
      header: t('backtest.table.barsHeld'),
      align: 'right',
      render: (r) => String(r.barsHeld),
    },
    {
      key: 'patternStop',
      header: t('backtest.table.patternStop'),
      align: 'center',
      render: (r) => (r.patternStopFired ? t('backtest.yes') : '—'),
    },
  ];
}
