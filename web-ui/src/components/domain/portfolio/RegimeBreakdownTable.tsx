import { t } from '@/i18n/t';
import StatsTable, { type StatsTableHeaders } from './StatsTable';
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

  const headers: StatsTableHeaders = {
    label: t('analyticsPage.regimeBreakdown.colRegime'),
    trades: t('analyticsPage.regimeBreakdown.colTrades'),
    winRate: t('analyticsPage.regimeBreakdown.colWinRate'),
    avgR: t('analyticsPage.regimeBreakdown.colAvgR'),
    expectancy: t('analyticsPage.regimeBreakdown.colExpectancy'),
    expectancyHint: t('analyticsPage.regimeBreakdown.expectancyHint'),
  };

  const rows = data.regimes.map((stat) => ({
    key: stat.regime,
    label: regimeLabel(stat.regime),
    labelClassName: regimeColorClass(stat.regime),
    count: stat.count,
    winRate: stat.winRate,
    avgR: stat.avgR,
    expectancy: stat.expectancy,
  }));

  return <StatsTable headers={headers} rows={rows} />;
}
