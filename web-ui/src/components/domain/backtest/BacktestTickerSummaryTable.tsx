import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import type { FullBacktestResponse } from '@/features/backtest/types';
import { t } from '@/i18n/t';
import { formatPercent, formatR } from '@/utils/formatters';

type BacktestTickerSummaryTableProps = {
  rows: FullBacktestResponse['summaryByTicker'];
};

export default function BacktestTickerSummaryTable({ rows }: BacktestTickerSummaryTableProps) {
  const columns: DataTableColumn<FullBacktestResponse['summaryByTicker'][number]>[] = [
    {
      key: 'ticker',
      header: t('backtestPage.summaryByTicker.headers.ticker'),
      render: (row) => <span className="font-medium">{row.ticker}</span>,
    },
    {
      key: 'trades',
      header: t('backtestPage.summaryByTicker.headers.trades'),
      render: (row) => row.trades,
    },
    {
      key: 'expectancy',
      header: t('backtestPage.summaryByTicker.headers.expectancy'),
      render: (row) => (row.expectancyR != null ? formatR(row.expectancyR) : t('common.placeholders.emDash')),
    },
    {
      key: 'winrate',
      header: t('backtestPage.summaryByTicker.headers.winRate'),
      render: (row) => (row.winrate != null ? formatPercent(row.winrate * 100) : t('common.placeholders.emDash')),
    },
    {
      key: 'avgR',
      header: t('backtestPage.summaryByTicker.headers.avgR'),
      render: (row) => (row.avgR != null ? formatR(row.avgR) : t('common.placeholders.emDash')),
    },
  ];

  return (
    <div className="max-h-[260px] overflow-y-auto">
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.ticker}
        emptyMessage={t('backtestPage.summaryByTicker.empty')}
        tableClassName="text-sm"
      />
    </div>
  );
}
