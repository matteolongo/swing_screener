import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import type { FullBacktestResponse } from '@/features/backtest/types';
import { formatPercent, formatR } from '@/utils/formatters';

type BacktestTickerSummaryTableProps = {
  rows: FullBacktestResponse['summaryByTicker'];
};

export default function BacktestTickerSummaryTable({ rows }: BacktestTickerSummaryTableProps) {
  const columns: DataTableColumn<FullBacktestResponse['summaryByTicker'][number]>[] = [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (row) => <span className="font-medium">{row.ticker}</span>,
    },
    {
      key: 'trades',
      header: 'Trades',
      render: (row) => row.trades,
    },
    {
      key: 'expectancy',
      header: 'Expectancy',
      render: (row) => (row.expectancyR != null ? formatR(row.expectancyR) : '—'),
    },
    {
      key: 'winrate',
      header: 'Win Rate',
      render: (row) => (row.winrate != null ? formatPercent(row.winrate * 100) : '—'),
    },
    {
      key: 'avgR',
      header: 'Avg R',
      render: (row) => (row.avgR != null ? formatR(row.avgR) : '—'),
    },
  ];

  return (
    <div className="max-h-[260px] overflow-y-auto">
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.ticker}
        emptyMessage="No ticker-level summary available."
        tableClassName="text-sm"
      />
    </div>
  );
}
