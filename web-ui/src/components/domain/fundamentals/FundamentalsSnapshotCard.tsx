import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import type { FundamentalMetricContext, FundamentalSnapshot } from '@/features/fundamentals/types';

function formatPercent(value?: number) {
  if (value == null) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value?: number) {
  if (value == null) return 'n/a';
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
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

function formatCadence(value?: string) {
  if (!value) return null;
  if (value === 'snapshot') return 'snapshot';
  if (value === 'quarterly') return 'quarterly';
  if (value === 'annual') return 'annual';
  return value;
}

function formatMetricMeta(context?: FundamentalMetricContext) {
  if (!context) return null;
  const parts: string[] = [];
  const cadence = formatCadence(context.cadence);
  if (cadence) parts.push(cadence);
  if (context.source) parts.push(context.source);
  if (context.derived) {
    parts.push(
      context.derivedFrom.length > 0 ? `derived from ${context.derivedFrom.join(' + ')}` : 'derived'
    );
  }
  if (context.periodEnd) parts.push(context.periodEnd);
  return parts.join(' · ') || null;
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          {metricCards.map((metric) => {
            const context = snapshot.metricContext[metric.key];
            const meta = formatMetricMeta(context);
            return (
              <div key={metric.key} className="rounded-md bg-gray-50 p-2">
                <div className="text-xs text-gray-500">{metric.label}</div>
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
                    {[formatCadence(series.frequency), series.source].filter(Boolean).join(' · ') || 'metadata unavailable'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {series.points.map((point) => (
                      <div key={`${key}-${point.periodEnd}`} className="rounded-md bg-gray-50 px-2 py-1 text-xs">
                        <div className="text-gray-500">{point.periodEnd}</div>
                        <div className="mt-1 font-medium text-gray-800">
                          {formatSeriesValue(point.value, series.unit)}
                        </div>
                      </div>
                    ))}
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
