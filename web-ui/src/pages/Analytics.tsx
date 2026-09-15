import { usePortfolioSummary } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import { formatNumber, getSignColorClass } from '@/utils/formatters';
import EdgeBreakdownTable from '@/components/domain/portfolio/EdgeBreakdownTable';
import RegimeBreakdownTable from '@/components/domain/portfolio/RegimeBreakdownTable';
import { EquityCurveChart, RDistributionChart } from '@/components/domain/analytics/AnalyticsCharts';
import { EdgeInsightCard, HowToReadBox, StatCard } from '@/components/domain/analytics/AnalyticsCards';
import AnalyticsTradeTable from '@/components/domain/analytics/AnalyticsTradeTable';

export default function Analytics() {
  const summary = usePortfolioSummary();
  const stats = summary.data?.analytics;
  const isLoading = summary.isLoading;
  const isError = summary.isError;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('analyticsPage.title')}</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-foreground/5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <p className="text-sm text-danger">{t('common.errors.generic')}</p>
      </div>
    );
  }

  const hasData = (stats?.closedTradeCount ?? 0) > 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('analyticsPage.title')}</h1>
        <p className="text-sm text-muted mt-1">{t('analyticsPage.subtitle')}</p>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted">{t('analyticsPage.empty')}</p>
      ) : (
        <>
          {/* Edge insight — computed verdict above stat cards */}
          <EdgeInsightCard
            insight={stats!.insight}
            totalTrades={stats!.closedTradeCount}
            averageR={stats!.averageR}
            profitFactor={stats!.profitFactor}
            winRate={stats!.winRate}
          />

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label={t('analyticsPage.stats.winRate')}
              value={stats!.winRate != null ? `${formatNumber(stats!.winRate, 1)}%` : '—'}
              colorClass={
                stats!.winRateStatus === 'neutral' ? undefined : `text-${stats!.winRateStatus === 'positive' ? 'success' : 'danger'}`
              }
              hint={t('analyticsPage.statHints.winLossSummary', {
                winCount: stats!.winCount,
                lossCount: stats!.lossCount,
                scratchCount: stats!.scratchCount,
                closedTradeCount: stats!.closedTradeCount,
              })}
            />
            <StatCard
              label={t('analyticsPage.stats.avgR')}
              value={stats!.averageR != null ? `${stats!.averageR >= 0 ? '+' : ''}${formatNumber(stats!.averageR, 2)}R` : '—'}
              colorClass={stats!.averageR != null ? getSignColorClass(stats!.averageR) : undefined}
              hint={t('analyticsPage.statHints.avgR')}
            />
            <StatCard
              label={t('analyticsPage.stats.profitFactor')}
              value={stats!.profitFactor != null ? formatNumber(stats!.profitFactor, 2) : '—'}
              colorClass={
                stats!.profitFactorStatus === 'neutral' ? undefined : `text-${stats!.profitFactorStatus === 'positive' ? 'success' : 'danger'}`
              }
              hint={t('analyticsPage.statHints.profitFactor')}
            />
            <StatCard
              label={t('analyticsPage.stats.avgHoldDays')}
              value={stats!.averageHoldingDays != null ? formatNumber(stats!.averageHoldingDays, 1) : '—'}
              hint={t('analyticsPage.statHints.avgHoldDays')}
            />
            <StatCard
              label={t('analyticsPage.stats.maxWinStreak')}
              value={String(stats!.maxWinStreak)}
              colorClass="text-success"
              hint={t('analyticsPage.statHints.maxWinStreak')}
            />
            <StatCard
              label={t('analyticsPage.stats.maxLossStreak')}
              value={String(stats!.maxLossStreak)}
              colorClass="text-danger"
              hint={t('analyticsPage.statHints.maxLossStreak')}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Equity Curve — 2/3 width */}
            <div className="col-span-3 lg:col-span-2 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted">
                  {t('analyticsPage.charts.equityCurve')}
                </h2>
                <span className="text-[11px] text-muted">{t('analyticsPage.charts.equityCurveHint')}</span>
              </div>
              <EquityCurveChart data={stats!.equityCurve} />
            </div>

            {/* R Distribution — 1/3 width */}
            <div className="col-span-3 lg:col-span-1 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted">
                  {t('analyticsPage.charts.rDistribution')}
                </h2>
                <span className="text-[11px] text-muted">{t('analyticsPage.charts.rDistributionHint')}</span>
              </div>
              <RDistributionChart values={stats!.equityCurve.map(point => point.r)} />
            </div>
          </div>

          {/* How to read */}
          <HowToReadBox />

          {/* Edge by setup type */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted">
              {t('analyticsPage.edgeBreakdown.title')}
            </h2>
            <EdgeBreakdownTable rows={stats!.tagBreakdown} />
          </section>

          {/* By market regime */}
          <section>
            <h2 className="mb-1 text-sm font-semibold text-muted">
              {t('analyticsPage.regimeBreakdown.title')}
            </h2>
            <p className="mb-3 text-xs text-muted">
              {t('analyticsPage.regimeBreakdown.subtitle')}
            </p>
            <RegimeBreakdownTable />
          </section>

          {/* Trade list table */}
          <AnalyticsTradeTable curve={stats!.equityCurve} />
        </>
      )}
    </div>
  );
}
