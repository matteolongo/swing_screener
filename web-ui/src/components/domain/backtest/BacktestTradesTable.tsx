import TableShell from '@/components/common/TableShell';
import type { FullBacktestResponse } from '@/features/backtest/types';
import { formatR } from '@/utils/formatters';

type BacktestTradesTableProps = {
  rows: FullBacktestResponse['trades'];
};

export default function BacktestTradesTable({ rows }: BacktestTradesTableProps) {
  return (
    <div className="max-h-[420px] overflow-y-auto">
      <TableShell
        empty={rows.length === 0}
        emptyMessage="No trades generated."
        tableClassName="text-sm"
        headers={(
          <tr className="text-left text-xs text-gray-500">
            <th className="py-2">Ticker</th>
            <th className="py-2">Entry</th>
            <th className="py-2">Exit</th>
            <th className="py-2">R</th>
            <th className="py-2">Exit Reason</th>
          </tr>
        )}
      >
        {rows.map((trade, idx) => (
          <tr key={`${trade.ticker}-${trade.entryDate}-${idx}`} className="border-t">
            <td className="py-2 font-medium">{trade.ticker}</td>
            <td className="py-2">{trade.entryDate}</td>
            <td className="py-2">{trade.exitDate}</td>
            <td className={`py-2 ${trade.r >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatR(trade.r)}</td>
            <td className="py-2">{trade.exitReason}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
