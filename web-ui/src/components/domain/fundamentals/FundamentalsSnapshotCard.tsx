import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import {
  formatFundamentalCadence,
  formatFundamentalMetricMeta,
  humanizeFundamentalSource,
  metricHorizonClass,
  metricHorizonLabel,
} from '@/features/fundamentals/presentation';

function formatPercent(value?: number) {
  if (value == null) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value?: number) {
  if (value == null) return 'n/a';
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatCompactNumber(value?: number) {
  if (value == null) return 'n/a';
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
  if (status === 'supported' || status === 'strong') return 'bg-emerald-100 text-emerald-800';
  if (status === 'partial' || status === 'neutral') return 'bg-amber-100 text-amber-800';
  if (status === 'unsupported' || status === 'weak') return 'bg-rose-100 text-rose-800';
  return 'bg-gray-100 text-gray-700';
}

function qualityBadgeClass(status: FundamentalSnapshot['dataQualityStatus']) {
  if (status === 'high') return 'bg-emerald-100 text-emerald-800';
  if (status === 'medium') return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

function trendClass(direction: 'improving' | 'deteriorating' | 'stable' | 'unknown' | 'not_comparable') {
  if (direction === 'improving') return 'bg-emerald-100 text-emerald-800';
  if (direction === 'deteriorating') return 'bg-rose-100 text-rose-800';
  if (direction === 'stable') return 'bg-amber-100 text-amber-800';
  if (direction === 'not_comparable') return 'bg-slate-100 text-slate-700';
  return 'bg-gray-100 text-gray-700';
}

function humanizeDirection(direction: 'improving' | 'deteriorating' | 'stable' | 'unknown' | 'not_comparable') {
  return direction === 'not_comparable' ? 'not comparable' : direction;
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
  const pillars = Object.entries(snapshot.pillars);
  const safeHighlights = filterTrendNarratives(snapshot.highlights, snapshot.historicalSeries);
  const safeRedFlags = filterTrendNarratives(snapshot.redFlags, snapshot.historicalSeries);
  const historicalSeries = Object.entries(snapshot.historicalSeries).sort(([left], [right]) => {
    const order = ['revenue', 'operating_margin', 'free_cash_flow_margin', 'free_cash_flow'];
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
  const metricCards = [
    {
      key: 'revenue_growth_yoy',
      label: 'Revenue YoY',
      value: formatPercent(snapshot.revenueGrowthYoy),
    },
    {
      key: 'earnings_growth_yoy',
      label: 'Earnings YoY',
      value: formatPercent(snapshot.earningsGrowthYoy),
    },
    {
      key: 'operating_margin',
      label: 'Operating Margin',
      value: formatPercent(snapshot.operatingMargin),
    },
    {
      key: 'free_cash_flow_margin',
      label: 'FCF Margin',
      value: formatPercent(snapshot.freeCashFlowMargin),
    },
    {
      key: 'debt_to_equity',
      label: 'Debt / Equity',
      value: formatNumber(snapshot.debtToEquity),
    },
    {
      key: 'trailing_pe',
      label: 'Trailing PE',
      value: formatNumber(snapshot.trailingPe),
    },
    {
      key: 'price_to_book',
      label: 'Price / Book',
      value: formatNumber(snapshot.priceToBook),
    },
    {
      key: 'book_value_per_share',
      label: 'Book Value / Share',
      value: formatNumber(snapshot.bookValuePerShare),
    },
    {
      key: 'book_to_price',
      label: 'Book / Price',
      value:
        snapshot.bookToPrice == null ? 'n/a' : `${(snapshot.bookToPrice * 100).toFixed(1)}%`,
    },
    {
      key: 'total_equity',
      label: 'Total Equity',
      value: formatCompactNumber(snapshot.totalEquity),
    },
    {
      key: 'shares_outstanding',
      label: 'Shares Outstanding',
      value: formatCompactNumber(snapshot.sharesOutstanding),
    },
  ] as const;

  return (
    <Card variant="bordered" className="h-full">
      <CardHeader className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{snapshot.symbol}</CardTitle>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {snapshot.companyName ?? 'Unknown company'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${pillStatusClass(snapshot.coverageStatus)}`}>
              {snapshot.coverageStatus}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
              {snapshot.freshnessStatus}
            </span>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${qualityBadgeClass(snapshot.dataQualityStatus)}`}>
              quality {snapshot.dataQualityStatus}
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
              {[snapshot.provider, snapshot.dataRegion].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          {metricCards.map((metric) => {
            const context = snapshot.metricContext[metric.key];
            const meta = formatFundamentalMetricMeta(metric.key, context);
            return (
              <div key={metric.key} className="rounded-md bg-gray-50 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-gray-500">{metric.label}</div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${metricHorizonClass(metric.key, context)}`}
                  >
                    {metricHorizonLabel(metric.key, context)}
                  </span>
                </div>
                <div className="mt-1 font-medium">{metric.value}</div>
                {meta ? <div className="mt-1 text-[11px] text-gray-500">{meta}</div> : null}
              </div>
            );
          })}
        </div>

        {historicalSeries.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent history</h4>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {historicalSeries.map(([key, series]) => (
                <div key={key} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{series.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${trendClass(series.direction)}`}>
                      {humanizeDirection(series.direction)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {[
                      formatFundamentalCadence(series.frequency),
                      humanizeFundamentalSource(series.source),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'metadata unavailable'}
                  </div>
                  <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            Date
                          </th>
                          <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {[...series.points]
                          .sort((left, right) => comparePeriodDesc(left.periodEnd, right.periodEnd))
                          .map((point) => (
                            <tr key={`${key}-${point.periodEnd}`}>
                              <td className="px-3 py-2 font-mono text-xs text-gray-500">
                                {point.periodEnd}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-800">
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

        {pillars.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pillar scores</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pillars.map(([name, pillar]) => (
                <div key={name} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium capitalize">{name.replace('_', ' ')}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pillStatusClass(pillar.status)}`}>
                      {pillar.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">{pillar.summary}</div>
                  <div className="mt-2 text-sm font-medium">
                    {pillar.score == null ? 'n/a' : `${Math.round(pillar.score * 100)}/100`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {snapshot.dataQualityFlags.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Data quality</h4>
            <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
              {snapshot.dataQualityFlags.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {safeHighlights.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Highlights</h4>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {safeHighlights.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {safeRedFlags.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-300">Red flags</h4>
            <ul className="mt-2 space-y-1 text-sm text-rose-700 dark:text-rose-300">
              {safeRedFlags.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {snapshot.error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {snapshot.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
