import { useEffect, useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import {
  getAvailablePriceRanges,
  getDefaultPriceRange,
  slicePriceHistory,
  type PriceRangeKey,
} from '@/features/screener/priceHistory';
import type { PriceHistoryPoint } from '@/features/screener/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { cn } from '@/utils/cn';
import { formatPercent } from '@/utils/formatters';

interface CachedSymbolPriceChartProps {
  ticker: string;
  className?: string;
  defaultOpen?: boolean;
  showToggle?: boolean;
  width?: number;
  height?: number;
}

const DEFAULT_CHART_WIDTH = 220;
const DEFAULT_CHART_HEIGHT = 72;
const CHART_PADDING = 4;
const EMPTY_HISTORY: PriceHistoryPoint[] = [];

interface ValueBounds {
  min: number;
  max: number;
}

function toShortDate(raw: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function getValueBounds(series: number[][]): ValueBounds | null {
  const values = series.flat().filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return null;
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function buildPolyline(
  points: number[],
  chartWidth: number,
  chartHeight: number,
  bounds?: ValueBounds | null,
): string {
  if (points.length === 0) {
    return '';
  }

  const minValue = bounds?.min ?? Math.min(...points);
  const maxValue = bounds?.max ?? Math.max(...points);
  const valueRange = maxValue - minValue;
  const usableWidth = chartWidth - CHART_PADDING * 2;
  const usableHeight = chartHeight - CHART_PADDING * 2;

  return points
    .map((value, idx) => {
      const x = CHART_PADDING + (points.length > 1 ? (idx / (points.length - 1)) * usableWidth : 0);
      const normalized = valueRange > 0 ? (value - minValue) / valueRange : 0.5;
      const y = CHART_PADDING + (1 - normalized) * usableHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function CachedSymbolPriceChart({
  ticker,
  className,
  defaultOpen = false,
  showToggle = true,
  width = DEFAULT_CHART_WIDTH,
  height = DEFAULT_CHART_HEIGHT,
}: CachedSymbolPriceChartProps) {
  const chartData = useScreenerStore((state) => {
    const symbol = ticker.trim().toUpperCase();
    const candidate = state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === symbol);
    return {
      history: candidate?.priceHistory ?? EMPTY_HISTORY,
      benchmarkHistory: candidate?.benchmarkPriceHistory ?? EMPTY_HISTORY,
      benchmarkTicker: state.lastResult?.benchmarkTicker,
      benchmarkChangePct: state.lastResult?.benchmarkChangePct,
      benchmarkLastBar: state.lastResult?.benchmarkLastBar,
      symbolChangePct: candidate?.symbolChangePct,
      benchmarkOutperformancePct: candidate?.benchmarkOutperformancePct,
    };
  });

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showBenchmarkOverlay, setShowBenchmarkOverlay] = useState(true);
  const availableRanges = useMemo(() => getAvailablePriceRanges(chartData.history), [chartData.history]);
  const [range, setRange] = useState<PriceRangeKey>('MAX');

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen, ticker]);

  useEffect(() => {
    if (availableRanges.length === 0) {
      return;
    }
    if (!availableRanges.includes(range)) {
      setRange(getDefaultPriceRange(availableRanges));
    }
  }, [availableRanges, range]);

  useEffect(() => {
    setShowBenchmarkOverlay(chartData.benchmarkHistory.length >= 2);
  }, [chartData.benchmarkHistory, ticker]);

  if (chartData.history.length < 2) {
    if (!showToggle) {
      return (
        <div className={cn('rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400', className)}>
          No cached chart is available for {ticker} yet.
        </div>
      );
    }
    return null;
  }

  const visibleHistory = slicePriceHistory(chartData.history, range);
  const visibleBenchmarkHistory = (() => {
    if (chartData.benchmarkHistory.length === 0 || visibleHistory.length === 0) {
      return [];
    }
    const visibleDates = new Set(visibleHistory.map((point) => point.date));
    return chartData.benchmarkHistory.filter((point) => visibleDates.has(point.date));
  })();

  const prices = visibleHistory.map((point) => point.close);
  const benchmarkPrices = visibleBenchmarkHistory.map((point) => point.close);
  const valueBounds = getValueBounds([prices, benchmarkPrices]);
  const polyline = buildPolyline(prices, width, height, valueBounds);
  const benchmarkPolyline = buildPolyline(benchmarkPrices, width, height, valueBounds);
  const firstPrice = prices[0] ?? 0;
  const lastPrice = prices[prices.length - 1] ?? 0;
  const changePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const isPositive = changePct >= 0;
  const showBenchmarkSummary =
    chartData.benchmarkTicker != null &&
    chartData.symbolChangePct != null &&
    chartData.benchmarkChangePct != null &&
    chartData.benchmarkOutperformancePct != null;
  const hasBenchmarkSeries = benchmarkPolyline.length > 0;
  const benchmarkLabel = chartData.benchmarkTicker ?? 'Benchmark';

  return (
    <div className={cn('mt-1', className)}>
      <div className={cn('grid gap-3', showBenchmarkSummary ? 'lg:grid-cols-[minmax(0,1fr)_170px]' : '')}>
        <div>
          <div className="flex items-center gap-2">
            {showToggle ? (
              <button
                type="button"
                onClick={() => setIsOpen((value) => !value)}
                className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                title={`Toggle cached chart for ${ticker}`}
                aria-label={`Toggle cached chart for ${ticker}`}
              >
                <LineChart className="h-3 w-3" />
                Chart
              </button>
            ) : null}

            {isOpen && availableRanges.length > 1 ? (
              <label className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                Range
                <select
                  value={range}
                  onChange={(event) => setRange(event.target.value as PriceRangeKey)}
                  className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  aria-label={`Price range for ${ticker}`}
                >
                  {availableRanges.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {hasBenchmarkSeries ? (
              <button
                type="button"
                onClick={() => setShowBenchmarkOverlay((value) => !value)}
                className={cn(
                  'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium',
                  showBenchmarkOverlay
                    ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
                )}
                aria-pressed={showBenchmarkOverlay}
                aria-label={`Toggle benchmark overlay for ${ticker}`}
                title={`Toggle benchmark overlay for ${benchmarkLabel}`}
              >
                {showBenchmarkOverlay ? 'Benchmark on' : 'Benchmark off'}
              </button>
            ) : null}
          </div>

          {isOpen ? (
            <div
              className={cn(
                'mt-2 rounded-md border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900',
                showToggle ? 'w-[230px]' : 'w-full',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Symbol
                  </span>
                  {hasBenchmarkSeries && chartData.benchmarkTicker ? (
                    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      {chartData.benchmarkTicker}
                    </span>
                  ) : null}
                </div>
                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{lastPrice.toFixed(2)}</span>
                <span className={cn('font-semibold', isPositive ? 'text-emerald-600' : 'text-rose-600')}>
                  {isPositive ? '+' : ''}
                  {changePct.toFixed(2)}%
                </span>
              </div>

              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full"
                style={{ height }}
                role="img"
                aria-label={`Cached price chart for ${ticker}`}
              >
                {showBenchmarkOverlay ? (
                  <polyline
                    points={benchmarkPolyline}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                    className="text-sky-500"
                  />
                ) : null}
                <polyline
                  points={polyline}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  className={isPositive ? 'text-emerald-500' : 'text-rose-500'}
                />
              </svg>

              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span>{toShortDate(visibleHistory[0]?.date ?? '')}</span>
                <span>{toShortDate(visibleHistory[visibleHistory.length - 1]?.date ?? '')}</span>
              </div>
            </div>
          ) : null}
        </div>

        {showBenchmarkSummary ? (
          <aside className="rounded-md border border-gray-200 bg-gray-50 p-2 text-[11px] shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">Benchmark</p>
                <p className="text-gray-500 dark:text-gray-400">{chartData.benchmarkTicker}</p>
              </div>
              <div
                className={cn(
                  'rounded-full px-2 py-0.5 font-semibold',
                  (chartData.benchmarkOutperformancePct ?? 0) >= 0
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
                )}
              >
                {(chartData.benchmarkOutperformancePct ?? 0) >= 0 ? 'Outperforming' : 'Lagging'}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400">Symbol</span>
                <span
                  className={cn(
                    'font-mono font-semibold',
                    (chartData.symbolChangePct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {formatPercent(chartData.symbolChangePct ?? 0, 1)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400">Benchmark</span>
                <span
                  className={cn(
                    'font-mono font-semibold',
                    (chartData.benchmarkChangePct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {formatPercent(chartData.benchmarkChangePct ?? 0, 1)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400">Diff</span>
                <span
                  className={cn(
                    'font-mono font-semibold',
                    (chartData.benchmarkOutperformancePct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {formatPercent(chartData.benchmarkOutperformancePct ?? 0, 1)}
                </span>
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                Compared on cached history up to {chartData.benchmarkLastBar ? toShortDate(chartData.benchmarkLastBar) : 'latest bar'}.
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
