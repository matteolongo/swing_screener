import { useMemo } from 'react';
import type { PriceHistoryPoint, CandlePattern } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import { cn } from '@/utils/cn';

interface CandleChartProps {
  ticker: string;
  bars: PriceHistoryPoint[];
  patterns: CandlePattern[];
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

function patternLabel(p: CandlePattern): string {
  const name = t(`chart.pattern.${p.name}` as MessageKey);
  const context = t(`chart.context.${p.context}` as MessageKey);
  return context ? `${name} · ${context}` : name;
}

export function CandleChart({
  ticker,
  bars,
  patterns,
  className,
  width = 640,
  height = 320,
}: CandleChartProps) {
  const usable = useMemo(() => toUsable(bars), [bars]);

  const bounds = useMemo(() => {
    if (usable.length === 0) {
      return { min: 0, max: 1 };
    }
    return {
      max: Math.max(...usable.map((b) => b.high)),
      min: Math.min(...usable.map((b) => b.low)),
    };
  }, [usable]);

  const maxVol = useMemo(() => Math.max(1, ...usable.map((b) => b.volume)), [usable]);

  if (usable.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center text-xs text-slate-400', className)}>
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

  return (
    <svg className={cn(className)} width={width} height={height} role="img" aria-label={`${ticker} candles`}>
      {usable.map((b, i) => {
        const x = PAD + i * slotW + slotW / 2;
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
      {patterns.map((p) => {
        const i = usable.findIndex((b) => b.date === p.date);
        if (i < 0) {
          return null;
        }
        const x = PAD + i * slotW + slotW / 2;
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
  );
}
