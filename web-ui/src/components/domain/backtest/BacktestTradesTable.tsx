import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import type { FullBacktestResponse } from '@/features/backtest/types';
import { formatR } from '@/utils/formatters';

type BacktestTradesTableProps = {
  rows: FullBacktestResponse['trades'];
};

export default function BacktestTradesTable({ rows }: BacktestTradesTableProps) {
  const columns: DataTableColumn<FullBacktestResponse['trades'][number]>[] = [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (trade) => <span className="font-medium">{trade.ticker}</span>,
    },
    {
      key: 'entry',
      header: 'Entry',
      render: (trade) => trade.entryDate,
    },
    {
      key: 'exit',
      header: 'Exit',
      render: (trade) => trade.exitDate,
    },
    {
      key: 'r',
      header: 'R',
      render: (trade) => (
        <span className={trade.r >= 0 ? 'text-green-600' : 'text-red-600'}>
          {formatR(trade.r)}
        </span>
      ),
    },
    {
      key: 'exitReason',
      header: 'Exit Reason',
      render: (trade) => trade.exitReason,
    },
  ];

  return (
    <div className="max-h-[420px] overflow-y-auto">
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(trade, idx) => `${trade.ticker}-${trade.entryDate}-${idx}`}
        emptyMessage="No trades generated."
        tableClassName="text-sm"
      />
    </div>
  );
}
