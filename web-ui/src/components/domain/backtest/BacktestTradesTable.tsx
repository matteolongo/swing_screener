import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import type { FullBacktestResponse } from '@/features/backtest/types';
import { t } from '@/i18n/t';
import { formatR } from '@/utils/formatters';

type BacktestTradesTableProps = {
  rows: FullBacktestResponse['trades'];
};

export default function BacktestTradesTable({ rows }: BacktestTradesTableProps) {
  const columns: DataTableColumn<FullBacktestResponse['trades'][number]>[] = [
    {
      key: 'ticker',
      header: t('backtestPage.trades.headers.ticker'),
      render: (trade) => <span className="font-medium">{trade.ticker}</span>,
    },
    {
      key: 'entry',
      header: t('backtestPage.trades.headers.entry'),
      render: (trade) => trade.entryDate,
    },
    {
      key: 'exit',
      header: t('backtestPage.trades.headers.exit'),
      render: (trade) => trade.exitDate,
    },
    {
      key: 'r',
      header: t('backtestPage.trades.headers.r'),
      render: (trade) => (
        <span className={trade.r >= 0 ? 'text-green-600' : 'text-red-600'}>
          {formatR(trade.r)}
        </span>
      ),
    },
    {
      key: 'exitReason',
      header: t('backtestPage.trades.headers.exitReason'),
      render: (trade) => trade.exitReason,
    },
  ];

  return (
    <div className="max-h-[420px] overflow-y-auto">
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(trade, idx) => `${trade.ticker}-${trade.entryDate}-${idx}`}
        emptyMessage={t('backtestPage.trades.empty')}
        tableClassName="text-sm"
      />
    </div>
  );
}
