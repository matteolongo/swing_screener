import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';
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
    case 'trending_up': return 'text-green-700 dark:text-green-400';
    case 'trending_down': return 'text-red-700 dark:text-red-400';
    case 'choppy': return 'text-yellow-600 dark:text-yellow-400';
  }
}

export default function RegimeBreakdownTable() {
  const { data, isLoading, isError } = useRegimeBreakdown();

  if (isLoading) {
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
        {t('analyticsPage.regimeBreakdown.loading')}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-red-600 dark:text-red-400">
        {t('analyticsPage.regimeBreakdown.error')}
      </p>
    );
  }

  if (!data || data.regimes.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
        {t('analyticsPage.regimeBreakdown.emptyState')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colRegime')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colTrades')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colWinRate')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colAvgR')}
            </th>
            <th
              className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              title={t('analyticsPage.regimeBreakdown.expectancyHint')}
            >
              {t('analyticsPage.regimeBreakdown.colExpectancy')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.regimes.map((stat) => (
            <tr key={stat.regime} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className={cn('px-4 py-3 font-semibold', regimeColorClass(stat.regime))}>
                {regimeLabel(stat.regime)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{stat.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{Math.round(stat.winRate)}%</td>
              <td className={cn(
                'px-4 py-3 text-right tabular-nums font-semibold',
                stat.avgR >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              )}>
                {stat.avgR >= 0 ? '+' : ''}{formatNumber(stat.avgR, 2)}R
              </td>
              <td className={cn(
                'px-4 py-3 text-right tabular-nums font-semibold',
                stat.expectancy >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              )}>
                {stat.expectancy >= 0 ? '+' : ''}{formatNumber(stat.expectancy, 2)}R
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
