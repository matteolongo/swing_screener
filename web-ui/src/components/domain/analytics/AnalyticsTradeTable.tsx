import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatNumber, formatCurrency } from '@/utils/formatters';
import RChip from '@/components/common/RChip';
import { finalR, holdingDays, maxR } from './analyticsStats';

export default function AnalyticsTradeTable({ positions }: { positions: Position[] }) {
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-foreground/5">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.table.date')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.table.ticker')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.table.entry')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.table.exit')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.table.finalR')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.table.maxR')}
              <span className="ml-1 font-normal normal-case opacity-60" title="Best paper gain reached before exit">↑peak</span>
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.table.holdDays')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {positions.map((p) => {
            const fr = finalR(p);
            const mr = maxR(p);
            const hd = holdingDays(p);
            const resultLabel = fr == null ? null : fr > 0 ? 'W' : fr < 0 ? 'L' : 'BE';
            const resultClass = fr == null ? '' : fr > 0
              ? 'bg-success/10 text-success'
              : fr < 0
                ? 'bg-danger/10 text-danger'
                : 'bg-foreground/5 text-muted';
            return (
              <tr key={p.positionId ?? `${p.ticker}-${p.exitDate}`} className="hover:bg-foreground/5">
                <td className="px-4 py-3 text-muted whitespace-nowrap">{p.exitDate ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {resultLabel && (
                      <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums', resultClass)}>
                        {resultLabel}
                      </span>
                    )}
                    <span className="font-semibold text-foreground">{p.ticker}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.entryPrice, 'EUR')}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p.exitPrice != null ? formatCurrency(p.exitPrice, 'EUR') : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {fr != null ? <RChip value={fr} /> : '—'}
                </td>
                <td className={cn('px-4 py-3 text-right tabular-nums',
                  mr != null && mr > 0 ? 'text-primary' : 'text-muted'
                )}>
                  {mr != null ? `${mr > 0 ? '+' : ''}${formatNumber(mr, 2)}R` : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {hd != null ? String(hd) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
