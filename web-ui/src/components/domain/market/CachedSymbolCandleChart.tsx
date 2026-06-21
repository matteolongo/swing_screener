import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { CandlePattern, PriceHistoryPoint } from '@/features/screener/types';
import {
  getAvailablePriceRanges,
  slicePriceHistory,
  type PriceRangeKey,
} from '@/features/screener/priceHistory';
import { useTickerCandles } from '@/features/screener/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { CandleChart } from './CandleChart';

interface CachedSymbolCandleChartProps {
  ticker: string;
  className?: string;
  width?: number;
  height?: number;
}

const EMPTY_BARS: PriceHistoryPoint[] = [];
const EMPTY_PATTERNS: CandlePattern[] = [];

interface ToolbarProps {
  availableRanges: PriceRangeKey[];
  range: PriceRangeKey;
  onRange: (range: PriceRangeKey) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

function ChartToolbar({ availableRanges, range, onRange, fullscreen, onToggleFullscreen }: ToolbarProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1">
        {availableRanges.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onRange(option)}
            aria-pressed={option === range}
            className={cn(
              'rounded border px-2 py-0.5 text-[11px] font-medium',
              option === range
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted hover:bg-foreground/5',
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? t('chart.exitFullscreen') : t('chart.fullscreen')}
        title={fullscreen ? t('chart.exitFullscreen') : t('chart.fullscreen')}
        className="rounded border border-border p-1 text-muted hover:bg-foreground/5"
      >
        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/**
 * Candlestick chart for full symbol views. Sources OHLCV bars, detected patterns,
 * and the benchmark comparison series from the cached screener result by ticker.
 * Adds a time-range selector (1W..MAX) and a fullscreen overlay.
 */
export function CachedSymbolCandleChart({ ticker, className, width, height }: CachedSymbolCandleChartProps) {
  const symbol = ticker.toUpperCase();
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((c) => c.ticker.toUpperCase() === symbol),
  );
  const benchmarkLabel = useScreenerStore((state) => state.lastResult?.benchmarkTicker ?? null);

  // Fall back to a direct API fetch when the ticker is not in the screener store
  // (e.g. open positions, watchlist items that were never screened).
  const candlesQuery = useTickerCandles(candidate ? null : symbol);

  const bars = candidate?.priceHistory ?? candlesQuery.data?.priceHistory ?? EMPTY_BARS;
  const patterns = candidate?.patterns ?? candlesQuery.data?.patterns ?? EMPTY_PATTERNS;
  const benchmarkBars = candidate?.benchmarkPriceHistory ?? EMPTY_BARS;
  const outperformancePct = candidate?.benchmarkOutperformancePct ?? null;

  const [range, setRange] = useState<PriceRangeKey>('MAX');
  const [fullscreen, setFullscreen] = useState(false);

  const availableRanges = useMemo(() => getAvailablePriceRanges(bars), [bars]);
  const effectiveRange = availableRanges.includes(range) ? range : 'MAX';

  const visibleBars = useMemo(() => slicePriceHistory(bars, effectiveRange), [bars, effectiveRange]);
  const visibleBenchmark = useMemo(
    () => slicePriceHistory(benchmarkBars, effectiveRange),
    [benchmarkBars, effectiveRange],
  );

  useEffect(() => {
    if (!fullscreen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const toolbar = (
    <ChartToolbar
      availableRanges={availableRanges}
      range={effectiveRange}
      onRange={setRange}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((value) => !value)}
    />
  );

  const overlayHeight = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.7) : 600;

  return (
    <div className={cn('w-full', className)}>
      {toolbar}
      <CandleChart
        ticker={ticker}
        bars={visibleBars}
        patterns={patterns}
        benchmarkBars={visibleBenchmark}
        benchmarkLabel={benchmarkLabel}
        outperformancePct={outperformancePct}
        width={width}
        height={height}
      />
      {fullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setFullscreen(false)}
          >
            <div
              className="w-full max-w-[95vw] rounded-lg bg-surface p-4 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              {toolbar}
              <CandleChart
                ticker={ticker}
                bars={visibleBars}
                patterns={patterns}
                benchmarkBars={visibleBenchmark}
                benchmarkLabel={benchmarkLabel}
                outperformancePct={outperformancePct}
                width={1280}
                height={overlayHeight}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default CachedSymbolCandleChart;
