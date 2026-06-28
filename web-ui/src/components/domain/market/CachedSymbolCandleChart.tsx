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

interface OverlayState {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  rLevels: boolean;
  keyLevels: boolean;
}

const EMPTY_BARS: PriceHistoryPoint[] = [];
const EMPTY_PATTERNS: CandlePattern[] = [];

const OVERLAY_CHIPS: {
  key: keyof OverlayState;
  label: string;
  color: string;
  title: string;
}[] = [
  { key: 'sma20', label: '20', color: '#F59E0B', title: 'SMA 20' },
  { key: 'sma50', label: '50', color: '#38BDF8', title: 'SMA 50' },
  { key: 'sma200', label: '200', color: '#A78BFA', title: 'SMA 200' },
  { key: 'rLevels', label: 'R', color: '#F0654E', title: 'Stop / Target levels' },
  { key: 'keyLevels', label: 'Key', color: '#7C8CF8', title: 'Key levels from patterns' },
];

interface ToolbarProps {
  availableRanges: PriceRangeKey[];
  range: PriceRangeKey;
  onRange: (range: PriceRangeKey) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  overlays: OverlayState;
  onToggleOverlay: (key: keyof OverlayState) => void;
}

function ChartToolbar({
  availableRanges,
  range,
  onRange,
  fullscreen,
  onToggleFullscreen,
  overlays,
  onToggleOverlay,
}: ToolbarProps) {
  return (
    <div className="mb-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
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
      <div className="flex flex-wrap gap-1">
        {OVERLAY_CHIPS.map(({ key, label, color, title }) => {
          const active = overlays[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggleOverlay(key)}
              aria-pressed={active}
              title={title}
              className={cn(
                'flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-opacity',
                active
                  ? 'border-border bg-surface text-foreground'
                  : 'border-border bg-surface text-muted opacity-40',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Candlestick chart for full symbol views. Sources OHLCV bars, detected patterns,
 * and the benchmark comparison series from the cached screener result by ticker.
 * Adds a time-range selector (1W..MAX), overlay toggles, and a fullscreen overlay.
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
  const entryPrice = candidate?.entry ?? null;
  const stopPrice = candidate?.stop ?? candidate?.patternStop ?? null;
  const targetPrice = candidate?.target ?? null;

  const [range, setRange] = useState<PriceRangeKey>('MAX');
  const [fullscreen, setFullscreen] = useState(false);
  const [overlays, setOverlays] = useState<OverlayState>({
    sma20: true,
    sma50: true,
    sma200: false,
    rLevels: true,
    keyLevels: true,
  });

  const toggleOverlay = (key: keyof OverlayState) =>
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));

  const availableRanges = useMemo(() => getAvailablePriceRanges(bars), [bars]);
  const effectiveRange = availableRanges.includes(range) ? range : 'MAX';

  const visibleBars = useMemo(() => slicePriceHistory(bars, effectiveRange), [bars, effectiveRange]);
  const visibleBenchmark = useMemo(
    () => slicePriceHistory(benchmarkBars, effectiveRange),
    [benchmarkBars, effectiveRange],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const sharedChartProps = {
    ticker,
    bars: visibleBars,
    patterns,
    benchmarkBars: visibleBenchmark,
    benchmarkLabel,
    outperformancePct,
    entryPrice,
    stopPrice,
    targetPrice,
    showSma20: overlays.sma20,
    showSma50: overlays.sma50,
    showSma200: overlays.sma200,
    showRLevels: overlays.rLevels,
    showKeyLevels: overlays.keyLevels,
  };

  const toolbarProps = {
    availableRanges,
    range: effectiveRange,
    onRange: setRange,
    fullscreen,
    onToggleFullscreen: () => setFullscreen((v) => !v),
    overlays,
    onToggleOverlay: toggleOverlay,
  };

  const overlayHeight = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.7) : 600;

  return (
    <div className={cn('w-full', className)}>
      <ChartToolbar {...toolbarProps} />
      <CandleChart {...sharedChartProps} width={width} height={height} />
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
              <ChartToolbar {...toolbarProps} />
              <CandleChart {...sharedChartProps} width={1280} height={overlayHeight} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default CachedSymbolCandleChart;
