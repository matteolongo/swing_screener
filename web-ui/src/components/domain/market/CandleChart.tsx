import { useMemo } from 'react';
import type { PriceHistoryPoint, CandlePattern } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import { cn } from '@/utils/cn';
import { formatPercent, getSignColorClass } from '@/utils/formatters';

interface CandleChartProps {
  ticker: string;
  bars: PriceHistoryPoint[];
  patterns: CandlePattern[];
  benchmarkBars?: PriceHistoryPoint[];
  benchmarkLabel?: string | null;
  outperformancePct?: number | null;
  className?: string;
  width?: number;
  height?: number;
}

const PAD = 8;
const VOL_FRACTION = 0.2;

interface UsableBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toUsable(bars: PriceHistoryPoint[]): UsableBar[] {
  const out: UsableBar[] = [];
  for (const b of bars) {
    if (b.open == null || b.high == null || b.low == null) {
      continue;
    }
    out.push({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
    });
  }
  return out;
}

/**
 * Rebase the benchmark onto the symbol's price axis: the benchmark line starts at
 * the symbol's close on the first shared bar and then moves by the benchmark's own
 * percentage changes. This shows relative strength regardless of price magnitude.
 */
function rebaseBenchmark(usable: UsableBar[], benchmarkBars: PriceHistoryPoint[]): (number | null)[] {
  const benchByDate = new Map(benchmarkBars.map((b) => [b.date, b.close]));
  let firstIdx = -1;
  for (let i = 0; i < usable.length; i += 1) {
    if (benchByDate.has(usable[i].date)) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx < 0) {
    return usable.map(() => null);
  }
  const baseBench = benchByDate.get(usable[firstIdx].date) as number;
  const baseSymbol = usable[firstIdx].close;
  if (!(baseBench > 0)) {
    return usable.map(() => null);
  }
  return usable.map((bar) => {
    const bench = benchByDate.get(bar.date);
    return bench == null ? null : baseSymbol * (bench / baseBench);
  });
}

function patternLabel(p: CandlePattern): string {
  const name = t(`chart.pattern.${p.name}` as MessageKey);
  const context = t(`chart.context.${p.context}` as MessageKey);
  return context ? `${name} · ${context}` : name;
}

export function CandleChart({
  ticker,
  bars,
  patterns,
  benchmarkBars = [],
  benchmarkLabel,
  outperformancePct,
  className,
  width = 640,
  height = 320,
}: CandleChartProps) {
  const usable = useMemo(() => toUsable(bars), [bars]);
  const benchmark = useMemo(() => rebaseBenchmark(usable, benchmarkBars), [usable, benchmarkBars]);
  const hasBenchmark = useMemo(() => benchmark.some((v) => v != null), [benchmark]);

  const bounds = useMemo(() => {
    if (usable.length === 0) {
      return { min: 0, max: 1 };
    }
    const values = [
      ...usable.map((b) => b.high),
      ...usable.map((b) => b.low),
      ...benchmark.filter((v): v is number => v != null),
    ];
    return { max: Math.max(...values), min: Math.min(...values) };
  }, [usable, benchmark]);

  const maxVol = useMemo(() => Math.max(1, ...usable.map((b) => b.volume)), [usable]);

  if (usable.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center text-xs text-muted', className)}>
        {ticker}
      </div>
    );
  }

  const priceH = height * (1 - VOL_FRACTION) - PAD * 2;
  const volTop = height * (1 - VOL_FRACTION);
  const volH = height * VOL_FRACTION - PAD;
  const slotW = (width - PAD * 2) / usable.length;
  const candleW = Math.max(1, slotW * 0.6);
  const range = bounds.max - bounds.min || 1;
  const yPrice = (v: number) => PAD + (1 - (v - bounds.min) / range) * priceH;
  const xOf = (i: number) => PAD + i * slotW + slotW / 2;

  const benchmarkPolyline = benchmark
    .map((v, i) => (v == null ? null : `${xOf(i).toFixed(2)},${yPrice(v).toFixed(2)}`))
    .filter((p): p is string => p != null)
    .join(' ');

  const showBenchmark = hasBenchmark && benchmarkLabel != null;

  return (
    <div className={cn('w-full', className)}>
      {showBenchmark && (
        <div className="mb-1 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t('chart.symbolLegend')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {benchmarkLabel}
          </span>
          {outperformancePct != null && (
            <span
              className={cn('font-mono font-semibold', getSignColorClass(outperformancePct))}
            >
              {formatPercent(outperformancePct, 1)}
            </span>
          )}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className="w-full"
        role="img"
        aria-label={`${ticker} candles`}
      >
        {usable.map((b, i) => {
          const x = xOf(i);
          const up = b.close >= b.open;
          const bodyTop = yPrice(Math.max(b.open, b.close));
          const bodyBot = yPrice(Math.min(b.open, b.close));
          const colorClass = up ? 'fill-emerald-500 stroke-emerald-500' : 'fill-rose-500 stroke-rose-500';
          const vh = (b.volume / maxVol) * volH;
          return (
            <g key={b.date}>
              <line x1={x} x2={x} y1={yPrice(b.high)} y2={yPrice(b.low)} className={colorClass} strokeWidth={1} />
              <rect
                data-testid="candle-body"
                data-direction={up ? 'up' : 'down'}
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={Math.max(1, bodyBot - bodyTop)}
                className={colorClass}
              />
              <rect
                data-testid="volume-bar"
                x={x - candleW / 2}
                y={volTop + (volH - vh)}
                width={candleW}
                height={vh}
                className={cn(colorClass, 'opacity-40')}
              />
            </g>
          );
        })}
        {showBenchmark && (
          <polyline
            data-testid="benchmark-line"
            points={benchmarkPolyline}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            className="stroke-sky-500"
          />
        )}
        {patterns.map((p) => {
          const i = usable.findIndex((b) => b.date === p.date);
          if (i < 0) {
            return null;
          }
          const x = xOf(i);
          const y = yPrice(p.keyLevel);
          return (
            <g key={`${p.name}-${p.date}`} data-testid="pattern-marker">
              <polygon
                points={`${x - 4},${y + 10} ${x + 4},${y + 10} ${x},${y + 2}`}
                className="fill-sky-400"
              />
              <title>{patternLabel(p)}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
