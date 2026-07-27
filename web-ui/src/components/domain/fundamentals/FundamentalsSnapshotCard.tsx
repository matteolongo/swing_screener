import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import {
  formatFundamentalCadence,
  formatFundamentalMetricMeta,
  humanizeFundamentalSource,
  metricHorizonClass,
  metricHorizonShortLabel,
  metricHorizonTooltip,
} from '@/features/fundamentals/presentation';
import { t } from '@/i18n/t';

function formatPercent(value?: number) {
  if (value == null) return t('workspacePage.fundamentals.card.notAvailable');
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value?: number) {
  if (value == null) return t('workspacePage.fundamentals.card.notAvailable');
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatCompactNumber(value?: number) {
  if (value == null) return t('workspacePage.fundamentals.card.notAvailable');
  return Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSeriesValue(value: number, unit: 'number' | 'currency' | 'percent' | 'ratio') {
  if (unit === 'percent') {
    return formatPercent(value);
  }
  if (unit === 'currency') {
    return Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatNumber(value);
}

function comparePeriodDesc(left: string, right: string) {
  return right.localeCompare(left);
}

function pillStatusClass(status: FundamentalSnapshot['coverageStatus'] | 'strong' | 'neutral' | 'weak' | 'unavailable') {
  if (status === 'supported' || status === 'strong') return 'bg-success/10 text-success';
  if (status === 'partial' || status === 'neutral') return 'bg-warning/10 text-warning';
  if (status === 'unsupported' || status === 'weak') return 'bg-danger/10 text-danger';
  return 'bg-surface text-muted';
}

function qualityBadgeClass(status: FundamentalSnapshot['dataQualityStatus']) {
  if (status === 'high') return 'bg-success/10 text-success';
  if (status === 'medium') return 'bg-warning/10 text-warning';
  return 'bg-danger/10 text-danger';
}

function trendClass(direction: 'improving' | 'deteriorating' | 'stable' | 'unknown' | 'not_comparable') {
  if (direction === 'improving') return 'bg-success/10 text-success';
  if (direction === 'deteriorating') return 'bg-danger/10 text-danger';
  if (direction === 'stable') return 'bg-warning/10 text-warning';
  if (direction === 'not_comparable') return 'bg-surface text-muted';
  return 'bg-surface text-muted';
}

function humanizeDirection(direction: 'improving' | 'deteriorating' | 'stable' | 'unknown' | 'not_comparable') {
  if (direction === 'not_comparable') {
    return t('workspacePage.fundamentals.card.statuses.notComparable');
  }
  return t(`workspacePage.fundamentals.card.statuses.${direction}`);
}

function isSupportedTrendNarrative(
  item: string,
  historicalSeries: FundamentalSnapshot['historicalSeries']
) {
  const normalized = item.trim().toLowerCase();
  const rules = [
    {
      key: 'revenue',
      direction: 'improving',
      patterns: ['revenue trend is improving'],
    },
    {
      key: 'revenue',
      direction: 'deteriorating',
      patterns: ['revenue trend is deteriorating'],
    },
    {
      key: 'operating_margin',
      direction: 'improving',
      patterns: ['margins are improving', 'operating margin is improving'],
    },
    {
      key: 'operating_margin',
      direction: 'deteriorating',
      patterns: ['operating margin is deteriorating'],
    },
    {
      key: 'free_cash_flow_margin',
      direction: 'improving',
      patterns: ['cash-flow conversion is improving'],
    },
    {
      key: 'free_cash_flow_margin',
      direction: 'deteriorating',
      patterns: ['cash-flow conversion is deteriorating'],
    },
  ] as const;

  for (const rule of rules) {
    if (!rule.patterns.some((pattern) => normalized.includes(pattern))) continue;
    return historicalSeries[rule.key]?.direction === rule.direction;
  }
  return true;
}

function filterTrendNarratives(
  items: string[],
  historicalSeries: FundamentalSnapshot['historicalSeries']
) {
  return items.filter((item) => isSupportedTrendNarrative(item, historicalSeries));
}

interface FundamentalsSnapshotCardProps {
  snapshot: FundamentalSnapshot;
}

export default function FundamentalsSnapshotCard({ snapshot }: FundamentalsSnapshotCardProps) {
  const notAvailable = t('workspacePage.fundamentals.card.notAvailable');
  const pillars = Object.entries(snapshot.pillars);
  const safeHighlights = filterTrendNarratives(snapshot.highlights, snapshot.historicalSeries);
  const safeRedFlags = filterTrendNarratives(snapshot.redFlags, snapshot.historicalSeries);
  const strongPillars = pillars.filter(([, pillar]) => pillar.status === 'strong');
  const weakPillars = pillars.filter(([, pillar]) => pillar.status === 'weak');
  const overallRead =
    strongPillars.length >= 2 && weakPillars.length === 0
      ? t('workspacePage.fundamentals.card.readPositive')
      : weakPillars.length >= 2
        ? t('workspacePage.fundamentals.card.readWeak')
        : t('workspacePage.fundamentals.card.readMixed');
  const topSupports = safeHighlights.slice(0, 2).length
    ? safeHighlights.slice(0, 2)
    : strongPillars.slice(0, 2).map(([name, pillar]) => `${name.replace('_', ' ')}: ${pillar.summary}`);
  const topConcerns = safeRedFlags.slice(0, 2).length
    ? safeRedFlags.slice(0, 2)
    : weakPillars.slice(0, 2).map(([name, pillar]) => `${name.replace('_', ' ')}: ${pillar.summary}`);
  const trustStatement = snapshot.dataQualityFlags[0]
    ?? (snapshot.dataQualityStatus === 'high'
      ? t('workspacePage.fundamentals.card.trustHigh')
      : t('workspacePage.fundamentals.card.trustCaution'));
  const historicalSeries = Object.entries(snapshot.historicalSeries).sort(([left], [right]) => {
    const order = ['revenue', 'operating_margin', 'free_cash_flow_margin', 'free_cash_flow'];
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
  const metricCards = [
    {
      key: 'revenue_growth_yoy',
      label: t('workspacePage.fundamentals.card.metrics.revenueGrowthYoy'),
      value: formatPercent(snapshot.revenueGrowthYoy),
    },
    {
      key: 'earnings_growth_yoy',
      label: t('workspacePage.fundamentals.card.metrics.earningsGrowthYoy'),
      value: formatPercent(snapshot.earningsGrowthYoy),
    },
    {
      key: 'operating_margin',
      label: t('workspacePage.fundamentals.card.metrics.operatingMargin'),
      value: formatPercent(snapshot.operatingMargin),
    },
    {
      key: 'free_cash_flow_margin',
      label: t('workspacePage.fundamentals.card.metrics.freeCashFlowMargin'),
      value: formatPercent(snapshot.freeCashFlowMargin),
    },
    {
      key: 'debt_to_equity',
      label: t('workspacePage.fundamentals.card.metrics.debtToEquity'),
      value: formatNumber(snapshot.debtToEquity),
    },
    {
      key: 'trailing_pe',
      label: t('workspacePage.fundamentals.card.metrics.trailingPe'),
      value: formatNumber(snapshot.trailingPe),
    },
    {
      key: 'price_to_book',
      label: t('workspacePage.fundamentals.card.metrics.priceToBook'),
      value: formatNumber(snapshot.priceToBook),
    },
    {
      key: 'book_value_per_share',
      label: t('workspacePage.fundamentals.card.metrics.bookValuePerShare'),
      value: formatNumber(snapshot.bookValuePerShare),
    },
    {
      key: 'book_to_price',
      label: t('workspacePage.fundamentals.card.metrics.bookToPrice'),
      value:
        snapshot.bookToPrice == null ? notAvailable : `${(snapshot.bookToPrice * 100).toFixed(1)}%`,
    },
    {
      key: 'total_equity',
      label: t('workspacePage.fundamentals.card.metrics.totalEquity'),
      value: formatCompactNumber(snapshot.totalEquity),
    },
    {
      key: 'shares_outstanding',
      label: t('workspacePage.fundamentals.card.metrics.sharesOutstanding'),
      value: formatCompactNumber(snapshot.sharesOutstanding),
    },
  ] as const;
  const availableMetrics = metricCards.filter((metric) => metric.value !== notAvailable);
  const unavailableMetrics = metricCards.filter((metric) => metric.value === notAvailable);

  return (
    <Card variant="bordered" className="h-full">
      <CardHeader className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{snapshot.symbol}</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {snapshot.companyName ?? t('workspacePage.fundamentals.card.unknownCompany')}
            </p>
            <p className="mt-1 text-xs text-muted">
              {[
                snapshot.sector,
                snapshot.currency,
                snapshot.mostRecentQuarter
                  ? t('workspacePage.fundamentals.card.mostRecent', {
                      period: snapshot.mostRecentQuarter,
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || t('workspacePage.fundamentals.card.contextUnavailable')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${pillStatusClass(snapshot.coverageStatus)}`}>
              {t(`workspacePage.fundamentals.card.statuses.${snapshot.coverageStatus}`)}
            </span>
            <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
              {t(`workspacePage.fundamentals.card.statuses.${snapshot.freshnessStatus}`)}
            </span>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${qualityBadgeClass(snapshot.dataQualityStatus)}`}>
              {t('workspacePage.fundamentals.card.qualityBadge', {
                status: t(`workspacePage.fundamentals.card.statuses.${snapshot.dataQualityStatus}`),
              })}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {[snapshot.provider, snapshot.dataRegion].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {snapshot.dataQualityFlags.length > 0 ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
            <h4 className="text-sm font-semibold text-warning">
              {t('workspacePage.fundamentals.card.dataQuality')}
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-warning">
              {snapshot.dataQualityFlags.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {t('workspacePage.fundamentals.card.overallRead')}
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{overallRead}</div>
            <p className="mt-2 text-sm text-muted">
              {t('workspacePage.fundamentals.card.overallHint')}
            </p>
          </div>
          <div className="rounded-md border border-success/40 bg-success/10 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-success">
              {t('workspacePage.fundamentals.card.keySupports')}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-success">
              {(topSupports.length
                ? topSupports
                : [t('workspacePage.fundamentals.card.noSupports')]).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-danger/40 bg-danger/10 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-danger">
              {t('workspacePage.fundamentals.card.mainConcerns')}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-danger">
              {(topConcerns.length
                ? topConcerns
                : [t('workspacePage.fundamentals.card.noConcerns')]).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-warning">
              {t('workspacePage.fundamentals.card.dataQuality')}
            </div>
            <p className="mt-2 text-sm text-warning">{trustStatement}</p>
            <p className="mt-2 text-xs text-warning">
              {t('workspacePage.fundamentals.card.qualityStatus', {
                status: t(`workspacePage.fundamentals.card.statuses.${snapshot.dataQualityStatus}`),
              })}
            </p>
          </div>
        </div>

        {pillars.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted">
              {t('workspacePage.fundamentals.card.pillarScores')}
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pillars.map(([name, pillar]) => (
                <div key={name} className="rounded-md border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium capitalize">{name.replace('_', ' ')}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pillStatusClass(pillar.status)}`}>
                      {t(`workspacePage.fundamentals.card.statuses.${pillar.status}`)}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {pillar.score == null ? notAvailable : `${Math.round(pillar.score * 100)}/100`}
                  </div>
                  <div className="mt-2 text-xs text-muted">{pillar.summary}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          {availableMetrics.map((metric) => {
            const context = snapshot.metricContext[metric.key];
            const meta = formatFundamentalMetricMeta(metric.key, context);
            return (
              <div key={metric.key} className="rounded-md bg-surface p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-muted">{metric.label}</div>
                  <span
                    className={`shrink-0 cursor-help whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${metricHorizonClass(metric.key, context)}`}
                    title={metricHorizonTooltip(metric.key, context)}
                  >
                    {metricHorizonShortLabel(metric.key, context)}
                  </span>
                </div>
                <div className="mt-1 font-medium">{metric.value}</div>
                {meta ? <div className="mt-1 text-[11px] text-muted">{meta}</div> : null}
              </div>
            );
          })}
        </div>
        {unavailableMetrics.length > 0 ? (
          <details className="rounded-md border border-border bg-surface p-3">
            <summary className="cursor-pointer text-sm font-medium text-muted">
              {t('workspacePage.fundamentals.unavailableCount', {
                count: unavailableMetrics.length,
              })}
            </summary>
            <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
              {unavailableMetrics.map((metric) => (
                <li key={metric.key}>{metric.label}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {(safeHighlights.length > 0 || safeRedFlags.length > 0) ? (
          <div className="grid gap-4 md:grid-cols-2">
            {safeHighlights.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-muted">
                  {t('workspacePage.fundamentals.card.highlights')}
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {safeHighlights.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {safeRedFlags.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-danger">
                  {t('workspacePage.fundamentals.card.redFlags')}
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-danger">
                  {safeRedFlags.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {historicalSeries.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted">
              {t('workspacePage.fundamentals.card.recentHistory')}
            </h4>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {historicalSeries.map(([key, series]) => (
                <div key={key} className="overflow-hidden rounded-md border border-border bg-surface">
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{series.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${trendClass(series.direction)}`}>
                        {humanizeDirection(series.direction)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted">
                      {[
                        formatFundamentalCadence(series.frequency),
                        humanizeFundamentalSource(series.source),
                      ]
                        .filter(Boolean)
                        .join(' · ') || t('workspacePage.fundamentals.card.metadataUnavailable')}
                    </div>
                  </div>
                  <div className="border-t border-border">
                    <table className="min-w-full divide-y divide-border text-sm">
                      <thead className="bg-surface">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted">
                            {t('workspacePage.fundamentals.card.date')}
                          </th>
                          <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted">
                            {t('workspacePage.fundamentals.card.value')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-surface">
                        {[...series.points]
                          .sort((left, right) => comparePeriodDesc(left.periodEnd, right.periodEnd))
                          .map((point) => (
                            <tr key={`${key}-${point.periodEnd}`}>
                              <td className="px-3 py-2 font-mono text-xs text-muted">
                                {point.periodEnd}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-foreground">
                                {formatSeriesValue(point.value, series.unit)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {snapshot.error ? (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {snapshot.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
