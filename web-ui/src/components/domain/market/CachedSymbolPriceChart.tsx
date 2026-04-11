import { useEffect, useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import {
  getAvailablePriceRanges,
  getDefaultPriceRange,
  slicePriceHistory,
  type PriceRangeKey,
} from '@/features/screener/priceHistory';
import { useScreenerStore } from '@/stores/screenerStore';
import { cn } from '@/utils/cn';

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
const EMPTY_HISTORY: never[] = [];

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

function buildPolyline(points: number[], chartWidth: number, chartHeight: number): string {
  if (points.length === 0) {
    return '';
  }

  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);
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
  const history = useScreenerStore((state) => {
    const symbol = ticker.trim().toUpperCase();
    const candidate = state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === symbol);
    return candidate?.priceHistory ?? EMPTY_HISTORY;
  });

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const availableRanges = useMemo(() => getAvailablePriceRanges(history), [history]);
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

  if (history.length < 2) {
    if (!showToggle) {
      return (
        <div className={cn('rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400', className)}>
          No cached chart is available for {ticker} yet.
        </div>
      );
    }
    return null;
  }

  const visibleHistory = slicePriceHistory(history, range);
  const prices = visibleHistory.map((point) => point.close);
  const polyline = buildPolyline(prices, width, height);
  const firstPrice = prices[0] ?? 0;
  const lastPrice = prices[prices.length - 1] ?? 0;
  const changePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const isPositive = changePct >= 0;

  return (
    <div className={cn('mt-1', className)}>
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
      </div>

      {isOpen ? (
        <div className={cn(
          'mt-2 rounded-md border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900',
          showToggle ? 'w-[230px]' : 'w-full',
        )}>
          <div className="mb-2 flex items-baseline justify-between text-[11px]">
            <span className="font-mono text-gray-500 dark:text-gray-400">{firstPrice.toFixed(2)}</span>
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
  );
}
