import { useMemo } from 'react';
import { usePositions } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import { formatNumber, getSignColorClass } from '@/utils/formatters';
import EdgeBreakdownTable from '@/components/domain/portfolio/EdgeBreakdownTable';
import RegimeBreakdownTable from '@/components/domain/portfolio/RegimeBreakdownTable';
import { computeAnalyticsStats } from '@/components/domain/analytics/analyticsStats';
import { EquityCurveChart, RDistributionChart } from '@/components/domain/analytics/AnalyticsCharts';
import { EdgeInsightCard, HowToReadBox, StatCard } from '@/components/domain/analytics/AnalyticsCards';
import AnalyticsTradeTable from '@/components/domain/analytics/AnalyticsTradeTable';

export default function Analytics() {
  const { data, isLoading, isError } = usePositions('closed');

  const stats = useMemo(() => computeAnalyticsStats(data), [data]);

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

  const hasData = stats.rValues.length > 0;

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
            totalTrades={stats.totalTrades}
            avgR={stats.avgR}
            profitFactor={stats.profitFactor}
            winRate={stats.winRate}
          />

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label={t('analyticsPage.stats.winRate')}
              value={stats.winRate != null ? `${formatNumber(stats.winRate, 1)}%` : '—'}
              colorClass={
                stats.winRate != null
                  ? stats.winRate >= 50 ? 'text-success' : 'text-danger'
                  : undefined
              }
              hint={`${stats.winCount}W · ${stats.lossCount}L · ${stats.beCount}BE of ${stats.totalTrades} trades`}
            />
            <StatCard
              label={t('analyticsPage.stats.avgR')}
              value={stats.avgR != null ? `${stats.avgR >= 0 ? '+' : ''}${formatNumber(stats.avgR, 2)}R` : '—'}
              colorClass={stats.avgR != null ? getSignColorClass(stats.avgR) : undefined}
              hint="avg R per closed trade"
            />
            <StatCard
              label={t('analyticsPage.stats.profitFactor')}
              value={stats.profitFactor != null ? formatNumber(stats.profitFactor, 2) : '—'}
              colorClass={
                stats.profitFactor != null
                  ? stats.profitFactor >= 1 ? 'text-success' : 'text-danger'
                  : undefined
              }
              hint="total gains ÷ total losses · > 1.0 = profitable"
            />
            <StatCard
              label={t('analyticsPage.stats.avgHoldDays')}
              value={stats.avgHoldDays != null ? formatNumber(stats.avgHoldDays, 1) : '—'}
              hint="days from entry to exit"
            />
            <StatCard
              label={t('analyticsPage.stats.maxWinStreak')}
              value={String(stats.maxWinStreak)}
              colorClass="text-success"
              hint="consecutive wins (longest run)"
            />
            <StatCard
              label={t('analyticsPage.stats.maxLossStreak')}
              value={String(stats.maxLossStreak)}
              colorClass="text-danger"
              hint="consecutive losses (longest run)"
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
                <span className="text-[11px] text-muted">hover a dot for trade detail</span>
              </div>
              <EquityCurveChart data={stats.equityCurve} />
            </div>

            {/* R Distribution — 1/3 width */}
            <div className="col-span-3 lg:col-span-1 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted">
                  {t('analyticsPage.charts.rDistribution')}
                </h2>
                <span className="text-[11px] text-muted">red = loss · green = win</span>
              </div>
              <RDistributionChart values={stats.rValues} />
            </div>
          </div>

          {/* How to read */}
          <HowToReadBox />

          {/* Edge by setup type */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted">
              {t('analyticsPage.edgeBreakdown.title')}
            </h2>
            <EdgeBreakdownTable positions={stats.sorted} />
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
          <AnalyticsTradeTable positions={stats.sorted} />
        </>
      )}
    </div>
  );
}
