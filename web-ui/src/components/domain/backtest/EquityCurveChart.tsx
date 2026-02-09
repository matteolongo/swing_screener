import { useEffect, useMemo, useState } from 'react';
import { BacktestCurvePoint } from '@/types/backtest';

const COLORS = [
  '#1d4ed8',
  '#0f766e',
  '#7c3aed',
  '#b45309',
  '#dc2626',
  '#16a34a',
  '#0284c7',
  '#f97316',
  '#db2777',
  '#84cc16',
];

interface SeriesPoint {
  x: number;
  y: number;
  date: string;
  value: number;
}

interface Series {
  id: string;
  label: string;
  color: string;
  points: SeriesPoint[];
}

interface EquityCurveChartProps {
  total: BacktestCurvePoint[];
  byTicker: BacktestCurvePoint[];
}

function buildSeries(total: BacktestCurvePoint[], byTicker: BacktestCurvePoint[]): Series[] {
  const series: Series[] = [];

  if (total.length > 0) {
    series.push({
      id: 'TOTAL',
      label: 'Total',
      color: '#111827',
      points: total.map((p) => ({
        x: new Date(p.date).getTime(),
        y: p.cumR,
        date: p.date,
        value: p.cumR,
      })),
    });
  }

  const byMap = new Map<string, BacktestCurvePoint[]>();
  byTicker.forEach((p) => {
    const t = p.ticker || 'UNKNOWN';
    if (!byMap.has(t)) {
      byMap.set(t, []);
    }
    byMap.get(t)!.push(p);
  });

  Array.from(byMap.entries()).forEach(([ticker, points], idx) => {
    series.push({
      id: ticker,
      label: ticker,
      color: COLORS[idx % COLORS.length],
      points: points
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((p) => ({
          x: new Date(p.date).getTime(),
          y: p.cumR,
          date: p.date,
          value: p.cumR,
        })),
    });
  });

  return series;
}

function linePath(points: SeriesPoint[], scaleX: (x: number) => number, scaleY: (y: number) => number): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`)
    .join(' ');
}

function buildTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count <= 1) {
    return [];
  }
  if (min === max) {
    return [min];
  }
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function formatDateTick(ts: number, spanDays: number): string {
  const d = new Date(ts);
  if (spanDays > 365 * 2) {
    return d.getFullYear().toString();
  }
  if (spanDays > 120) {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export default function EquityCurveChart({ total, byTicker }: EquityCurveChartProps) {
  const series = useMemo(() => buildSeries(total, byTicker), [total, byTicker]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setVisible((prev) => {
      const next: Record<string, boolean> = { ...prev };
      series.forEach((s) => {
        if (next[s.id] === undefined) {
          next[s.id] = true;
        }
      });
      return next;
    });
  }, [series.map((s) => s.id).join('|')]);

  const visibleSeries = series.filter((s) => visible[s.id]);

  const bounds = useMemo(() => {
    const allPoints = visibleSeries.flatMap((s) => s.points);
    if (allPoints.length === 0) {
      return null;
    }
    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [visibleSeries]);

  if (series.length === 0) {
    return <div className="text-sm text-gray-500">No equity curve data.</div>;
  }

  const width = 900;
  const height = 280;
  const pad = 32;
  const rangeX = bounds ? Math.max(1, bounds.maxX - bounds.minX) : 1;
  const rangeY = bounds ? Math.max(1, bounds.maxY - bounds.minY) : 1;

  const scaleX = (x: number) => pad + ((x - (bounds?.minX || 0)) / rangeX) * (width - pad * 2);
  const scaleY = (y: number) => height - pad - ((y - (bounds?.minY || 0)) / rangeY) * (height - pad * 2);
  const spanDays = bounds ? (bounds.maxX - bounds.minX) / (1000 * 60 * 60 * 24) : 0;
  const xTicks = bounds ? buildTicks(bounds.minX, bounds.maxX, 5) : [];
  const yTicks = bounds ? buildTicks(bounds.minY, bounds.maxY, 5) : [];

  return (
    <div>
      <div className="flex flex-wrap gap-3 text-xs mb-3">
        {series.map((s) => (
          <label key={s.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={visible[s.id] ?? true}
              onChange={() => setVisible((prev) => ({ ...prev, [s.id]: !(prev[s.id] ?? true) }))}
            />
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          </label>
        ))}
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px]">
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5e7eb" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />
          {yTicks.map((yVal) => {
            const y = scaleY(yVal);
            return (
              <g key={`y-${yVal}`}>
                <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#f1f5f9" />
                <line x1={pad - 4} y1={y} x2={pad} y2={y} stroke="#cbd5f5" />
                <text x={pad - 8} y={y + 4} fontSize="10" textAnchor="end" fill="#64748b">
                  {yVal.toFixed(2)}
                </text>
              </g>
            );
          })}
          {xTicks.map((xVal) => {
            const x = scaleX(xVal);
            return (
              <g key={`x-${xVal}`}>
                <line x1={x} y1={pad} x2={x} y2={height - pad} stroke="#f8fafc" />
                <line x1={x} y1={height - pad} x2={x} y2={height - pad + 4} stroke="#cbd5f5" />
                <text x={x} y={height - pad + 16} fontSize="10" textAnchor="middle" fill="#64748b">
                  {formatDateTick(xVal, spanDays)}
                </text>
              </g>
            );
          })}
          {visibleSeries.map((s) => (
            <path
              key={s.id}
              d={linePath(s.points, scaleX, scaleY)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.id === 'TOTAL' ? 2.5 : 1.8}
              opacity={s.id === 'TOTAL' ? 0.9 : 0.75}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
