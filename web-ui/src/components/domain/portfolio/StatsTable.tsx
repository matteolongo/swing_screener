import { cn } from '@/utils/cn';
import RChip from '@/components/common/RChip';

export interface StatsTableRow {
  key: string;
  label: string;
  /** Optional Tailwind class for the label cell (e.g. regime sign coloring). Defaults to `text-foreground`. */
  labelClassName?: string;
  count: number;
  /** Win rate as a percentage (0-100). */
  winRate: number;
  avgR: number;
  expectancy: number;
}

export interface StatsTableHeaders {
  label: string;
  trades: string;
  winRate: string;
  avgR: string;
  expectancy: string;
  expectancyHint: string;
}

interface StatsTableProps {
  headers: StatsTableHeaders;
  rows: StatsTableRow[];
}

const HEADER_CELL = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted';

export default function StatsTable({ headers, rows }: StatsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-foreground/5">
            <th className={cn(HEADER_CELL, 'text-left')}>{headers.label}</th>
            <th className={cn(HEADER_CELL, 'text-right')}>{headers.trades}</th>
            <th className={cn(HEADER_CELL, 'text-right')}>{headers.winRate}</th>
            <th className={cn(HEADER_CELL, 'text-right')}>{headers.avgR}</th>
            <th className={cn(HEADER_CELL, 'text-right')} title={headers.expectancyHint}>
              {headers.expectancy}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-foreground/5">
              <td className={cn('px-4 py-3 font-semibold', row.labelClassName ?? 'text-foreground')}>
                {row.label}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{Math.round(row.winRate)}%</td>
              <td className="px-4 py-3 text-right">
                <RChip value={row.avgR} />
              </td>
              <td className="px-4 py-3 text-right">
                <RChip value={row.expectancy} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
