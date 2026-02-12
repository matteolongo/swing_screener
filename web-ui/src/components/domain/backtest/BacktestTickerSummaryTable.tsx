import TableShell from '@/components/common/TableShell';
import type { FullBacktestResponse } from '@/features/backtest/types';
import { formatPercent, formatR } from '@/utils/formatters';

type BacktestTickerSummaryTableProps = {
  rows: FullBacktestResponse['summaryByTicker'];
};

export default function BacktestTickerSummaryTable({ rows }: BacktestTickerSummaryTableProps) {
  return (
    <div className="max-h-[260px] overflow-y-auto">
      <TableShell
        empty={rows.length === 0}
        emptyMessage="No ticker-level summary available."
        tableClassName="text-sm"
        headers={(
          <tr className="text-left text-xs text-gray-500">
            <th className="py-2">Ticker</th>
            <th className="py-2">Trades</th>
            <th className="py-2">Expectancy</th>
            <th className="py-2">Win Rate</th>
            <th className="py-2">Avg R</th>
          </tr>
        )}
      >
        {rows.map((row) => (
          <tr key={row.ticker} className="border-t">
            <td className="py-2 font-medium">{row.ticker}</td>
            <td className="py-2">{row.trades}</td>
            <td className="py-2">{row.expectancyR != null ? formatR(row.expectancyR) : '—'}</td>
            <td className="py-2">{row.winrate != null ? formatPercent(row.winrate * 100) : '—'}</td>
            <td className="py-2">{row.avgR != null ? formatR(row.avgR) : '—'}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
