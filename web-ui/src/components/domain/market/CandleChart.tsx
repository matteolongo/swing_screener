import { useEffect, useMemo, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type ISeriesApi,
  type SeriesType,
  type IPriceLine,
} from 'lightweight-charts';
import type { PriceHistoryPoint, CandlePattern } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import { cn } from '@/utils/cn';
import { formatPercent, getSignColorClass } from '@/utils/formatters';

// Hardcoded from index.css design tokens — update both if tokens change
const SUCCESS = '#46C28E';
const DANGER = '#F0654E';
const PRIMARY = '#7C8CF8';
const SMA20_COLOR = '#F59E0B';
const SMA50_COLOR = '#38BDF8';
const SMA200_COLOR = '#A78BFA';
const MUTED_LINE = '#475569';

interface CandleChartProps {
  ticker: string;
  bars: PriceHistoryPoint[];
  patterns: CandlePattern[];
  benchmarkBars?: PriceHistoryPoint[];
  benchmarkLabel?: string | null;
  outperformancePct?: number | null;
  entryPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  showSma20?: boolean;
  showSma50?: boolean;
  showSma200?: boolean;
  showRLevels?: boolean;
  showKeyLevels?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

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
    if (b.open == null || b.high == null || b.low == null) continue;
    out.push({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 });
  }
  return out;
}

/**
 * Rebase benchmark onto the symbol's price axis: starts at symbol's close on the
 * first shared bar, then moves by benchmark's own percentage changes.
 */
export function rebaseBenchmark(usable: UsableBar[], benchmarkBars: PriceHistoryPoint[]): (number | null)[] {
  const benchByDate = new Map(benchmarkBars.map((b) => [b.date, b.close]));
  let firstIdx = -1;
  for (let i = 0; i < usable.length; i++) {
    if (benchByDate.has(usable[i].date)) { firstIdx = i; break; }
  }
  if (firstIdx < 0) return usable.map(() => null);
  const baseBench = benchByDate.get(usable[firstIdx].date) as number;
  const baseSymbol = usable[firstIdx].close;
  if (!(baseBench > 0)) return usable.map(() => null);
  return usable.map((bar) => {
    const bench = benchByDate.get(bar.date);
    return bench == null ? null : baseSymbol * (bench / baseBench);
  });
}

export function computeSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    return sum / period;
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
  entryPrice,
  stopPrice,
  targetPrice,
  showSma20 = true,
  showSma50 = true,
  showSma200 = false,
  showRLevels = true,
  showKeyLevels = true,
  className,
  height = 320,
}: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs for toggling visibility without recreating the chart
  const sma20Ref = useRef<ISeriesApi<SeriesType> | null>(null);
  const sma50Ref = useRef<ISeriesApi<SeriesType> | null>(null);
  const sma200Ref = useRef<ISeriesApi<SeriesType> | null>(null);
  const rLineRefs = useRef<IPriceLine[]>([]);
  const keyLineRefs = useRef<IPriceLine[]>([]);

  const usable = useMemo(() => toUsable(bars), [bars]);
  const rebasedBenchmark = useMemo(() => rebaseBenchmark(usable, benchmarkBars), [usable, benchmarkBars]);
  const showBenchmark = useMemo(
    () => benchmarkLabel != null && rebasedBenchmark.some((v) => v != null),
    [benchmarkLabel, rebasedBenchmark],
  );

  // Chart creation — reruns on data changes, reads current visibility flags on creation
  useEffect(() => {
    const container = containerRef.current;
    if (!container || usable.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#1e2a3a' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderVisible: false,
        fixRightEdge: true,
        fixLeftEdge: true,
      },
      crosshair: {
        horzLine: { labelBackgroundColor: '#1e2a3a' },
        vertLine: { labelBackgroundColor: '#1e2a3a' },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: SUCCESS,
      downColor: DANGER,
      wickUpColor: SUCCESS,
      wickDownColor: DANGER,
      borderVisible: false,
    });
    candleSeries.setData(
      usable.map((b) => ({ time: b.date, open: b.open, high: b.high, low: b.low, close: b.close })),
    );

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeries.setData(
      usable.map((b) => ({
        time: b.date,
        value: b.volume,
        color: b.close >= b.open ? `${SUCCESS}66` : `${DANGER}66`,
      })),
    );

    // SMA overlays — visibility flag read from closure at creation time
    const closes = usable.map((b) => b.close);
    const smaConfigs: [number, string, React.MutableRefObject<ISeriesApi<SeriesType> | null>, boolean][] = [
      [20, SMA20_COLOR, sma20Ref, showSma20],
      [50, SMA50_COLOR, sma50Ref, showSma50],
      [200, SMA200_COLOR, sma200Ref, showSma200],
    ];
    for (const [period, color, ref, visible] of smaConfigs) {
      const values = computeSMA(closes, period);
      const data = usable
        .map((b, i) => (values[i] != null ? { time: b.date, value: values[i] as number } : null))
        .filter((p): p is { time: string; value: number } => p != null);
      if (data.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          title: `SMA${period}`,
          visible,
        });
        s.setData(data);
        ref.current = s;
      } else {
        ref.current = null;
      }
    }

    // R-level price lines
    const rLines: IPriceLine[] = [];
    if (stopPrice != null) {
      rLines.push(candleSeries.createPriceLine({ price: stopPrice, color: DANGER, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SL', lineVisible: showRLevels }));
    }
    if (entryPrice != null) {
      rLines.push(candleSeries.createPriceLine({ price: entryPrice, color: MUTED_LINE, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'E', lineVisible: showRLevels }));
    }
    if (targetPrice != null) {
      rLines.push(candleSeries.createPriceLine({ price: targetPrice, color: SUCCESS, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'T', lineVisible: showRLevels }));
    }
    rLineRefs.current = rLines;

    // Key level dotted lines from patterns
    const keyLevels = [...new Set(patterns.map((p) => p.keyLevel))];
    const kLines: IPriceLine[] = keyLevels.map((level) =>
      candleSeries.createPriceLine({ price: level, color: `${PRIMARY}80`, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '', lineVisible: showKeyLevels }),
    );
    keyLineRefs.current = kLines;

    // Benchmark overlay line
    if (showBenchmark) {
      const lineData = usable
        .map((b, i) => (rebasedBenchmark[i] != null ? { time: b.date, value: rebasedBenchmark[i] as number } : null))
        .filter((p): p is { time: string; value: number } => p != null);
      const lineSeries = chart.addSeries(LineSeries, {
        color: PRIMARY,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      lineSeries.setData(lineData);
    }

    // Pattern markers
    if (patterns.length > 0) {
      const markers = patterns
        .map((p) => {
          const bar = usable.find((b) => b.date === p.date);
          if (!bar) return null;
          return {
            time: p.date,
            position: (p.direction === 'bearish' ? 'aboveBar' : 'belowBar') as 'aboveBar' | 'belowBar',
            shape: (p.direction === 'bearish' ? 'arrowDown' : 'arrowUp') as 'arrowDown' | 'arrowUp',
            color: PRIMARY,
            text: patternLabel(p),
          };
        })
        .filter((m): m is NonNullable<typeof m> => m != null);
      createSeriesMarkers(candleSeries, markers);
    }

    return () => {
      chart.remove();
      sma20Ref.current = null;
      sma50Ref.current = null;
      sma200Ref.current = null;
      rLineRefs.current = [];
      keyLineRefs.current = [];
    };
  }, [usable, rebasedBenchmark, showBenchmark, patterns, entryPrice, stopPrice, targetPrice]);

  // Visibility effects — update series/lines without recreating the chart
  useEffect(() => { sma20Ref.current?.applyOptions({ visible: showSma20 }); }, [showSma20]);
  useEffect(() => { sma50Ref.current?.applyOptions({ visible: showSma50 }); }, [showSma50]);
  useEffect(() => { sma200Ref.current?.applyOptions({ visible: showSma200 }); }, [showSma200]);
  useEffect(() => { rLineRefs.current.forEach((l) => l.applyOptions({ lineVisible: showRLevels })); }, [showRLevels]);
  useEffect(() => { keyLineRefs.current.forEach((l) => l.applyOptions({ lineVisible: showKeyLevels })); }, [showKeyLevels]);

  if (usable.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center text-xs text-muted', className)}>
        {ticker}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {showBenchmark && (
        <div className="mb-1 flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success" />
            {t('chart.symbolLegend')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {benchmarkLabel}
          </span>
          {outperformancePct != null && (
            <span className={cn('font-mono font-semibold', getSignColorClass(outperformancePct))}>
              {formatPercent(outperformancePct, 1)}
            </span>
          )}
        </div>
      )}
      <div ref={containerRef} data-testid="candle-chart-container" style={{ height }} />
    </div>
  );
}
