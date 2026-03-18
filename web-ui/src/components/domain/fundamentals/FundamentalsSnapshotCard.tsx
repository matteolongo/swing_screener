import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';

function formatPercent(value?: number) {
  if (value == null) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value?: number) {
  if (value == null) return 'n/a';
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function pillStatusClass(status: FundamentalSnapshot['coverageStatus'] | 'strong' | 'neutral' | 'weak' | 'unavailable') {
  if (status === 'supported' || status === 'strong') return 'bg-emerald-100 text-emerald-800';
  if (status === 'partial' || status === 'neutral') return 'bg-amber-100 text-amber-800';
  if (status === 'unsupported' || status === 'weak') return 'bg-rose-100 text-rose-800';
  return 'bg-gray-100 text-gray-700';
}

interface FundamentalsSnapshotCardProps {
  snapshot: FundamentalSnapshot;
}

export default function FundamentalsSnapshotCard({ snapshot }: FundamentalsSnapshotCardProps) {
  const pillars = Object.entries(snapshot.pillars);

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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-xs text-gray-500">Revenue YoY</div>
            <div className="mt-1 font-medium">{formatPercent(snapshot.revenueGrowthYoy)}</div>
          </div>
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-xs text-gray-500">Earnings YoY</div>
            <div className="mt-1 font-medium">{formatPercent(snapshot.earningsGrowthYoy)}</div>
          </div>
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-xs text-gray-500">Operating Margin</div>
            <div className="mt-1 font-medium">{formatPercent(snapshot.operatingMargin)}</div>
          </div>
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-xs text-gray-500">FCF Margin</div>
            <div className="mt-1 font-medium">{formatPercent(snapshot.freeCashFlowMargin)}</div>
          </div>
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-xs text-gray-500">Debt / Equity</div>
            <div className="mt-1 font-medium">{formatNumber(snapshot.debtToEquity)}</div>
          </div>
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-xs text-gray-500">Trailing PE</div>
            <div className="mt-1 font-medium">{formatNumber(snapshot.trailingPe)}</div>
          </div>
        </div>

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

        {snapshot.highlights.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Highlights</h4>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {snapshot.highlights.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {snapshot.redFlags.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-300">Red flags</h4>
            <ul className="mt-2 space-y-1 text-sm text-rose-700 dark:text-rose-300">
              {snapshot.redFlags.map((item) => (
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
