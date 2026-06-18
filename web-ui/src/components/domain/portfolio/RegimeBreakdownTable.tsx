import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import RChip from '@/components/common/RChip';
import { useRegimeBreakdown } from '@/features/portfolio/hooks';
import type { RegimeStats } from '@/features/portfolio/api';

function regimeLabel(regime: RegimeStats['regime']): string {
  const map: Record<RegimeStats['regime'], string> = {
    trending_up: t('analyticsPage.regimeBreakdown.regimes.trending_up'),
    trending_down: t('analyticsPage.regimeBreakdown.regimes.trending_down'),
    choppy: t('analyticsPage.regimeBreakdown.regimes.choppy'),
  };
  return map[regime] ?? regime;
}

function regimeColorClass(regime: RegimeStats['regime']): string {
  switch (regime) {
    case 'trending_up': return 'text-success';
    case 'trending_down': return 'text-danger';
    case 'choppy': return 'text-warning';
  }
}

export default function RegimeBreakdownTable() {
  const { data, isLoading, isError } = useRegimeBreakdown();

  if (isLoading) {
    return (
      <p className="py-4 text-sm text-muted">
        {t('analyticsPage.regimeBreakdown.loading')}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-danger">
        {t('analyticsPage.regimeBreakdown.error')}
      </p>
    );
  }

  if (!data || data.regimes.length === 0) {
    return (
      <p className="py-4 text-sm text-muted">
        {t('analyticsPage.regimeBreakdown.emptyState')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-foreground/5">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.regimeBreakdown.colRegime')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.regimeBreakdown.colTrades')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.regimeBreakdown.colWinRate')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
              {t('analyticsPage.regimeBreakdown.colAvgR')}
            </th>
            <th
              className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted"
              title={t('analyticsPage.regimeBreakdown.expectancyHint')}
            >
              {t('analyticsPage.regimeBreakdown.colExpectancy')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.regimes.map((stat) => (
            <tr key={stat.regime} className="hover:bg-foreground/5">
              <td className={cn('px-4 py-3 font-semibold', regimeColorClass(stat.regime))}>
                {regimeLabel(stat.regime)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{stat.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{Math.round(stat.winRate)}%</td>
              <td className="px-4 py-3 text-right"><RChip value={stat.avgR} /></td>
              <td className="px-4 py-3 text-right"><RChip value={stat.expectancy} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
