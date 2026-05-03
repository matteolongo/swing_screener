import { useMemo } from 'react';
import { usePositions } from '@/features/portfolio/hooks';
import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatNumber, formatCurrency } from '@/utils/formatters';
import EdgeBreakdownTable from '@/components/domain/portfolio/EdgeBreakdownTable';

// ─── helpers ────────────────────────────────────────────────────────────────

function finalR(p: Position): number | null {
  if (!p.initialRisk || p.initialRisk <= 0 || p.exitPrice == null) return null;
  return (p.exitPrice - p.entryPrice) / p.initialRisk;
}

function maxR(p: Position): number | null {
  if (!p.initialRisk || p.initialRisk <= 0 || p.maxFavorablePrice == null) return null;
  return (p.maxFavorablePrice - p.entryPrice) / p.initialRisk;
}

function holdingDays(p: Position): number | null {
  if (!p.exitDate || !p.entryDate) return null;
  const diff = new Date(p.exitDate).getTime() - new Date(p.entryDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function maxStreak(flags: boolean[]): number {
  let max = 0;
  let cur = 0;
  for (const f of flags) {
    if (f) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

// ─── stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  colorClass?: string;
  hint?: string;
}

function StatCard({ label, value, colorClass, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', colorClass ?? 'text-gray-900 dark:text-gray-100')}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{hint}</p> : null}
    </div>
  );
}

// ─── equity curve SVG ────────────────────────────────────────────────────────

interface EquityPoint { date: string; cumulativeR: number; r: number }

function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  const W = 600;
  const H = 240;
  const PAD = { top: 20, right: 24, bottom: 36, left: 52 };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm text-gray-400 dark:text-gray-500">
        {t('analyticsPage.labels.noTrades')}
      </div>
    );
  }

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const cumRValues = data.map((d) => d.cumulativeR);
  const minR = Math.min(0, ...cumRValues);
  const maxRv = Math.max(0, ...cumRValues);
  const range = maxRv - minR || 1;

  const xScale = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
  const yScale = (v: number) => PAD.top + chartH - ((v - minR) / range) * chartH;

  const y0 = yScale(0);
  const finalCumR = data[data.length - 1].cumulativeR;
  const lineColor = finalCumR >= 0 ? '#16a34a' : '#dc2626';

  // area fill path
  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.cumulativeR)}`).join(' ');
  const areaPath = `${linePath} L${xScale(data.length - 1)},${y0} L${xScale(0)},${y0} Z`;

  // Y-axis gridlines at integer R values
  const minRInt = Math.floor(minR);
  const maxRvInt = Math.ceil(maxRv);
  const gridValues: number[] = [];
  for (let v = minRInt; v <= maxRvInt; v++) {
    gridValues.push(v);
  }

  // X-axis labels: show every Nth
  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(data.length / maxLabels));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={t('analyticsPage.charts.equityCurve')}>
      {/* Y-axis gridlines */}
      {gridValues.map((v) => (
        <line
          key={v}
          x1={PAD.left} y1={yScale(v)}
          x2={W - PAD.right} y2={yScale(v)}
          stroke={v === 0 ? '#9ca3af' : '#e5e7eb'}
          strokeWidth={v === 0 ? 1 : 0.5}
          strokeDasharray={v === 0 ? '4 4' : undefined}
        />
      ))}

      {/* area fill */}
      <path d={areaPath} fill={lineColor} opacity={0.08} />

      {/* equity curve */}
      {data.length === 1 ? (
        <circle cx={xScale(0)} cy={yScale(data[0].cumulativeR)} r={4} fill={lineColor} />
      ) : (
        <polyline points={data.map((d, i) => `${xScale(i)},${yScale(d.cumulativeR)}`).join(' ')} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
      )}

      {/* trade dots with tooltips */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.cumulativeR)} r={3.5} fill={d.r > 0 ? '#16a34a' : d.r < 0 ? '#dc2626' : '#9ca3af'} opacity={0.8}>
          <title>{d.date} — {d.r >= 0 ? '+' : ''}{formatNumber(d.r, 2)}R  (cumulative: {d.cumulativeR >= 0 ? '+' : ''}{formatNumber(d.cumulativeR, 2)}R)</title>
        </circle>
      ))}

      {/* final R label */}
      <text
        x={xScale(data.length - 1) - 6}
        y={yScale(finalCumR) - 7}
        textAnchor="end"
        fontSize={11}
        fill={lineColor}
        fontWeight="600"
      >
        {finalCumR >= 0 ? '+' : ''}{formatNumber(finalCumR, 2)}R
      </text>

      {/* Y-axis labels */}
      {gridValues.map((v) => (
        <text key={v} x={PAD.left - 5} y={yScale(v) + 4} textAnchor="end" fontSize={9} fill="#6b7280">
          {v === 0 ? '0' : (v > 0 ? `+${v}` : String(v))}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((d, i) => {
        const idx = data.indexOf(d);
        return (
          <text key={i} x={xScale(idx)} y={H - 6} textAnchor="middle" fontSize={9} fill="#6b7280">
            {d.date}
          </text>
        );
      })}
    </svg>
  );
}

// ─── R distribution bar chart ────────────────────────────────────────────────

interface Bucket { label: string; shortLabel: string; min: number | null; max: number | null; count: number; color: string }

function RDistributionChart({ values }: { values: number[] }) {
  const W = 300;
  const H = 220;
  const PAD = { top: 20, right: 12, bottom: 52, left: 16 };

  const buckets: Bucket[] = [
    { label: t('analyticsPage.labels.bucket.veryNegative'), shortLabel: '< −2R', min: null, max: -2, count: 0, color: '#dc2626' },
    { label: t('analyticsPage.labels.bucket.negative'), shortLabel: '−2 to −1R', min: -2, max: -1, count: 0, color: '#ef4444' },
    { label: t('analyticsPage.labels.bucket.smallNegative'), shortLabel: '−1 to 0R', min: -1, max: 0, count: 0, color: '#f87171' },
    { label: t('analyticsPage.labels.bucket.smallPositive'), shortLabel: '0 to +1R', min: 0, max: 1, count: 0, color: '#4ade80' },
    { label: t('analyticsPage.labels.bucket.positive'), shortLabel: '+1 to +2R', min: 1, max: 2, count: 0, color: '#16a34a' },
    { label: t('analyticsPage.labels.bucket.veryPositive'), shortLabel: '> +2R', min: 2, max: null, count: 0, color: '#15803d' },
  ];

  for (const v of values) {
    if (v < -2) buckets[0].count++;
    else if (v < -1) buckets[1].count++;
    else if (v < 0) buckets[2].count++;
    else if (v < 1) buckets[3].count++;
    else if (v < 2) buckets[4].count++;
    else buckets[5].count++;
  }

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = chartW / buckets.length;
  const gap = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={t('analyticsPage.charts.rDistribution')}>
      {buckets.map((b, i) => {
        const barH = Math.max(0, (b.count / maxCount) * chartH);
        const x = PAD.left + i * barW + gap / 2;
        const bw = barW - gap;
        const filledY = PAD.top + chartH - barH;

        return (
          <g key={i}>
            {/* ghost outline for empty buckets */}
            {b.count === 0 && (
              <rect
                x={x} y={PAD.top + chartH - 4}
                width={bw} height={4}
                fill={b.color} opacity={0.2} rx={2}
              />
            )}
            {/* filled bar */}
            {b.count > 0 && (
              <rect x={x} y={filledY} width={bw} height={barH} fill={b.color} rx={2} opacity={0.85}>
                <title>{b.label}: {b.count} trade{b.count !== 1 ? 's' : ''}</title>
              </rect>
            )}
            {/* count label */}
            {b.count > 0 && (
              <text x={x + bw / 2} y={filledY - 4} textAnchor="middle" fontSize={10} fill={b.color} fontWeight="600">
                {b.count}
              </text>
            )}
            {/* x-axis label */}
            <text
              x={x + bw / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize={7.5}
              fill="#6b7280"
              transform={`rotate(-35 ${x + bw / 2} ${H - 4})`}
            >
              {b.shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── how to read explainer ───────────────────────────────────────────────────

function HowToReadBox() {
  return (
    <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 select-none">
        How to read this page
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="font-semibold text-gray-800 dark:text-gray-200">R (Risk unit)</dt>
          <dd className="mt-0.5 text-gray-500 dark:text-gray-400">1R = your initial risk per trade (entry − stop × shares). Every result is expressed as a multiple: +2R means you made 2× your risk, −1R means you lost your full planned risk.</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-800 dark:text-gray-200">Avg R</dt>
          <dd className="mt-0.5 text-gray-500 dark:text-gray-400">Average R across all closed trades. Must stay above 0R over time to grow the account. Negative avg R means every trade costs you money on average.</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-800 dark:text-gray-200">Profit Factor</dt>
          <dd className="mt-0.5 text-gray-500 dark:text-gray-400">Total gains ÷ total losses (in R). 1.0 = break even, &gt; 1.0 = profitable. A value of 0.20 means for every 1R gained, 5R is lost in aggregate.</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-800 dark:text-gray-200">Max R</dt>
          <dd className="mt-0.5 text-gray-500 dark:text-gray-400">The best paper gain reached during the trade before exit (based on highest price). Useful to understand how much you left on the table vs. how much you captured.</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-800 dark:text-gray-200">Equity Curve</dt>
          <dd className="mt-0.5 text-gray-500 dark:text-gray-400">Cumulative R over time — each dot is one closed trade. Hover a dot to see the individual result. A flat or rising curve above 0 is the goal.</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-800 dark:text-gray-200">R Distribution</dt>
          <dd className="mt-0.5 text-gray-500 dark:text-gray-400">How many trades landed in each R outcome bucket. Red bars = losses, green = wins. Empty buckets appear as thin marks. Ideal shape: taller bars on the right than the left.</dd>
        </div>
      </dl>
    </details>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function Analytics() {
  const { data, isLoading, isError } = usePositions('closed');

  const stats = useMemo(() => {
    const positions = (data ?? []).filter((p) => p.exitDate);
    const sorted = [...positions].sort((a, b) => (a.exitDate ?? '') < (b.exitDate ?? '') ? -1 : 1);

    const rValues = sorted.map(finalR).filter((r): r is number => r !== null);
    const hDays = sorted.map(holdingDays).filter((d): d is number => d !== null);

    const winCount = rValues.filter((r) => r > 0).length;
    const lossCount = rValues.filter((r) => r < 0).length;
    const beCount = rValues.filter((r) => r === 0).length;

    const winRate = (winCount + lossCount) > 0 ? (winCount / (winCount + lossCount)) * 100 : null;
    const avgRVal = mean(rValues);
    const positiveSum = rValues.filter((r) => r > 0).reduce((a, b) => a + b, 0);
    const negativeSum = rValues.filter((r) => r < 0).reduce((a, b) => a + b, 0);
    const profitFactor = negativeSum !== 0 ? positiveSum / Math.abs(negativeSum) : null;
    const avgHold = mean(hDays);

    // streaks
    const sortedRFlags = sorted.map((p) => (finalR(p) ?? 0) > 0);
    const wStreak = maxStreak(sortedRFlags);
    const lStreak = maxStreak(sortedRFlags.map((f) => !f));

    // equity curve
    let cumR = 0;
    const equityCurve: EquityPoint[] = sorted
      .filter((p) => finalR(p) !== null)
      .map((p) => {
        const r = finalR(p)!;
        cumR += r;
        return { date: p.exitDate!.slice(5), cumulativeR: cumR, r };
      });

    return {
      winRate,
      avgR: avgRVal,
      profitFactor,
      avgHoldDays: avgHold,
      maxWinStreak: wStreak,
      maxLossStreak: lStreak,
      equityCurve,
      rValues,
      sorted,
      winCount,
      lossCount,
      beCount,
      totalTrades: rValues.length,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('analyticsPage.title')}</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <p className="text-sm text-red-600">{t('common.errors.generic')}</p>
      </div>
    );
  }

  const hasData = stats.rValues.length > 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('analyticsPage.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('analyticsPage.subtitle')}</p>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('analyticsPage.empty')}</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label={t('analyticsPage.stats.winRate')}
              value={stats.winRate != null ? `${formatNumber(stats.winRate, 1)}%` : '—'}
              colorClass={
                stats.winRate != null
                  ? stats.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  : undefined
              }
              hint={`${stats.winCount}W · ${stats.lossCount}L · ${stats.beCount}BE of ${stats.totalTrades} trades`}
            />
            <StatCard
              label={t('analyticsPage.stats.avgR')}
              value={stats.avgR != null ? `${stats.avgR >= 0 ? '+' : ''}${formatNumber(stats.avgR, 2)}R` : '—'}
              colorClass={
                stats.avgR != null
                  ? stats.avgR > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  : undefined
              }
              hint="avg R per closed trade"
            />
            <StatCard
              label={t('analyticsPage.stats.profitFactor')}
              value={stats.profitFactor != null ? formatNumber(stats.profitFactor, 2) : '—'}
              colorClass={
                stats.profitFactor != null
                  ? stats.profitFactor >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
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
              colorClass="text-green-600 dark:text-green-400"
              hint="consecutive wins (longest run)"
            />
            <StatCard
              label={t('analyticsPage.stats.maxLossStreak')}
              value={String(stats.maxLossStreak)}
              colorClass="text-red-600 dark:text-red-400"
              hint="consecutive losses (longest run)"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Equity Curve — 2/3 width */}
            <div className="col-span-3 lg:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('analyticsPage.charts.equityCurve')}
                </h2>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">hover a dot for trade detail</span>
              </div>
              <EquityCurveChart data={stats.equityCurve} />
            </div>

            {/* R Distribution — 1/3 width */}
            <div className="col-span-3 lg:col-span-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('analyticsPage.charts.rDistribution')}
                </h2>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">red = loss · green = win</span>
              </div>
              <RDistributionChart values={stats.rValues} />
            </div>
          </div>

          {/* How to read */}
          <HowToReadBox />

          {/* Edge by setup type */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('analyticsPage.edgeBreakdown.title')}
            </h2>
            <EdgeBreakdownTable positions={stats.sorted} />
          </section>

          {/* Trade list table */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('analyticsPage.table.date')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('analyticsPage.table.ticker')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('analyticsPage.table.entry')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('analyticsPage.table.exit')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('analyticsPage.table.finalR')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('analyticsPage.table.maxR')}
                    <span className="ml-1 font-normal normal-case opacity-60" title="Best paper gain reached before exit">↑peak</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('analyticsPage.table.holdDays')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stats.sorted.map((p) => {
                  const fr = finalR(p);
                  const mr = maxR(p);
                  const hd = holdingDays(p);
                  const resultLabel = fr == null ? null : fr > 0 ? 'W' : fr < 0 ? 'L' : 'BE';
                  const resultClass = fr == null ? '' : fr > 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : fr < 0
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
                  return (
                    <tr key={p.positionId ?? `${p.ticker}-${p.exitDate}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.exitDate ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {resultLabel && (
                            <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums', resultClass)}>
                              {resultLabel}
                            </span>
                          )}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{p.ticker}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.entryPrice, 'EUR')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.exitPrice != null ? formatCurrency(p.exitPrice, 'EUR') : '—'}
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums font-semibold',
                        fr != null ? (fr > 0 ? 'text-green-600 dark:text-green-400' : fr < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500') : ''
                      )}>
                        {fr != null ? `${fr > 0 ? '+' : ''}${formatNumber(fr, 2)}R` : '—'}
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums',
                        mr != null && mr > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                      )}>
                        {mr != null ? `${mr > 0 ? '+' : ''}${formatNumber(mr, 2)}R` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {hd != null ? String(hd) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
