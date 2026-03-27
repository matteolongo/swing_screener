import { useMemo } from 'react';
import { usePositions } from '@/features/portfolio/hooks';
import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatNumber, formatCurrency } from '@/utils/formatters';

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
}

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', colorClass ?? 'text-gray-900 dark:text-gray-100')}>{value}</p>
    </div>
  );
}

// ─── equity curve SVG ────────────────────────────────────────────────────────

interface EquityPoint { date: string; cumulativeR: number; r: number }

function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  const W = 600;
  const H = 220;
  const PAD = { top: 16, right: 24, bottom: 36, left: 48 };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-gray-500">
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

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.cumulativeR)}`).join(' ');
  const finalCumR = data[data.length - 1].cumulativeR;
  const lineColor = finalCumR >= 0 ? '#16a34a' : '#dc2626';
  const y0 = yScale(0);

  // X-axis labels: show every Nth
  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(data.length / maxLabels));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={t('analyticsPage.charts.equityCurve')}>
      {/* zero line */}
      <line
        x1={PAD.left} y1={y0}
        x2={W - PAD.right} y2={y0}
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* equity curve */}
      {data.length === 1 ? (
        <circle cx={xScale(0)} cy={yScale(data[0].cumulativeR)} r={4} fill={lineColor} />
      ) : (
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
      )}

      {/* final R label */}
      <text
        x={xScale(data.length - 1) - 4}
        y={yScale(finalCumR) - 6}
        textAnchor="end"
        fontSize={11}
        fill={lineColor}
        fontWeight="600"
      >
        {finalCumR >= 0 ? '+' : ''}{formatNumber(finalCumR, 2)}R
      </text>

      {/* X-axis labels */}
      {xLabels.map((d, i) => {
        const idx = data.indexOf(d);
        return (
          <text
            key={i}
            x={xScale(idx)}
            y={H - 6}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            {d.date}
          </text>
        );
      })}

      {/* Y-axis labels */}
      {[minR, 0, maxRv].filter((v, i, a) => a.indexOf(v) === i).map((v, i) => (
        <text key={i} x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end" fontSize={9} fill="#6b7280">
          {formatNumber(v, 1)}
        </text>
      ))}
    </svg>
  );
}

// ─── R distribution bar chart ────────────────────────────────────────────────

interface Bucket { label: string; min: number | null; max: number | null; count: number; color: string }

function RDistributionChart({ values }: { values: number[] }) {
  const W = 300;
  const H = 200;
  const PAD = { top: 16, right: 12, bottom: 48, left: 16 };

  const buckets: Bucket[] = [
    { label: t('analyticsPage.labels.bucket.veryNegative'), min: null, max: -2, count: 0, color: '#dc2626' },
    { label: t('analyticsPage.labels.bucket.negative'), min: -2, max: -1, count: 0, color: '#ef4444' },
    { label: t('analyticsPage.labels.bucket.smallNegative'), min: -1, max: 0, count: 0, color: '#f87171' },
    { label: t('analyticsPage.labels.bucket.smallPositive'), min: 0, max: 1, count: 0, color: '#4ade80' },
    { label: t('analyticsPage.labels.bucket.positive'), min: 1, max: 2, count: 0, color: '#16a34a' },
    { label: t('analyticsPage.labels.bucket.veryPositive'), min: 2, max: null, count: 0, color: '#15803d' },
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
        const barH = (b.count / maxCount) * chartH;
        const x = PAD.left + i * barW + gap / 2;
        const y = PAD.top + chartH - barH;
        const bw = barW - gap;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={barH} fill={b.color} rx={2} opacity={0.85} />
            {b.count > 0 && (
              <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={10} fill={b.color} fontWeight="600">
                {b.count}
              </text>
            )}
            <text
              x={x + bw / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize={8}
              fill="#6b7280"
              transform={`rotate(-30 ${x + bw / 2} ${H - 4})`}
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
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
                  ? stats.winRate >= 50
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  : undefined
              }
            />
            <StatCard
              label={t('analyticsPage.stats.avgR')}
              value={stats.avgR != null ? `${stats.avgR >= 0 ? '+' : ''}${formatNumber(stats.avgR, 2)}R` : '—'}
              colorClass={
                stats.avgR != null
                  ? stats.avgR > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  : undefined
              }
            />
            <StatCard
              label={t('analyticsPage.stats.profitFactor')}
              value={stats.profitFactor != null ? formatNumber(stats.profitFactor, 2) : '—'}
              colorClass={
                stats.profitFactor != null
                  ? stats.profitFactor >= 1
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  : undefined
              }
            />
            <StatCard
              label={t('analyticsPage.stats.avgHoldDays')}
              value={stats.avgHoldDays != null ? formatNumber(stats.avgHoldDays, 1) : '—'}
            />
            <StatCard
              label={t('analyticsPage.stats.maxWinStreak')}
              value={String(stats.maxWinStreak)}
              colorClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              label={t('analyticsPage.stats.maxLossStreak')}
              value={String(stats.maxLossStreak)}
              colorClass="text-red-600 dark:text-red-400"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Equity Curve — 2/3 width */}
            <div className="col-span-3 lg:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t('analyticsPage.charts.equityCurve')}
              </h2>
              <EquityCurveChart data={stats.equityCurve} />
            </div>

            {/* R Distribution — 1/3 width */}
            <div className="col-span-3 lg:col-span-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t('analyticsPage.charts.rDistribution')}
              </h2>
              <RDistributionChart values={stats.rValues} />
            </div>
          </div>

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
                  return (
                    <tr key={p.positionId ?? `${p.ticker}-${p.exitDate}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.exitDate ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{p.ticker}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.entryPrice, 'EUR')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.exitPrice != null ? formatCurrency(p.exitPrice, 'EUR') : '—'}
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums font-semibold', fr != null ? (fr > 0 ? 'text-green-600 dark:text-green-400' : fr < 0 ? 'text-red-600 dark:text-red-400' : '') : '')}>
                        {fr != null ? `${fr > 0 ? '+' : ''}${formatNumber(fr, 2)}R` : '—'}
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums', mr != null ? 'text-blue-600 dark:text-blue-400' : '')}>
                        {mr != null ? `${formatNumber(mr, 2)}R` : '—'}
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
