import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import type { EquityPoint } from './analyticsStats';

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  const W = 600;
  const H = 240;
  const PAD = { top: 20, right: 24, bottom: 36, left: 52 };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm text-muted">
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

interface Bucket { label: string; shortLabel: string; min: number | null; max: number | null; count: number; color: string }

export function RDistributionChart({ values }: { values: number[] }) {
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
