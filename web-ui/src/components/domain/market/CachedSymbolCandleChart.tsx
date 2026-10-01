import { lazy, Suspense, useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import ModalShell from '@/components/common/ModalShell';
import type { CandlePattern, PriceHistoryPoint } from '@/features/screener/types';
import {
  getAvailablePriceRanges,
  slicePriceHistory,
  type PriceRangeKey,
} from '@/features/screener/priceHistory';
import { useTickerCandles } from '@/features/screener/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

const CandleChart = lazy(() => import('./CandleChart').then((module) => ({ default: module.CandleChart })));

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
  titleKey: 'chart.overlays.sma20' | 'chart.overlays.sma50' | 'chart.overlays.sma200' | 'chart.overlays.rLevels' | 'chart.overlays.keyLevels';
}[] = [
  { key: 'sma20', label: '20', color: '#F59E0B', titleKey: 'chart.overlays.sma20' },
  { key: 'sma50', label: '50', color: '#38BDF8', titleKey: 'chart.overlays.sma50' },
  { key: 'sma200', label: '200', color: '#A78BFA', titleKey: 'chart.overlays.sma200' },
  { key: 'rLevels', label: 'R', color: '#F0654E', titleKey: 'chart.overlays.rLevels' },
  { key: 'keyLevels', label: 'Key', color: '#7C8CF8', titleKey: 'chart.overlays.keyLevels' },
];

function ChartLoadingFallback({ height }: { height?: number }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded border border-border bg-surface text-sm text-muted"
      style={{ height: height ?? 360 }}
      role="status"
    >
      {t('chart.loading')}
    </div>
  );
}

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
        {OVERLAY_CHIPS.map(({ key, label, color, titleKey }) => {
          const active = overlays[key];
          const title = t(titleKey);
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
 * and the benchmark comparison series from the selected review snapshot when
 * one exists, with cached/direct data fallbacks for unselected symbols.
 * Adds a time-range selector (1W..MAX), overlay toggles, and a fullscreen overlay.
 */
export function CachedSymbolCandleChart({ ticker, className, width, height }: CachedSymbolCandleChartProps) {
  const symbol = ticker.toUpperCase();
  const selection = useWorkspaceStore((state) => state.selection);
  const selectedCandidate = selection?.ticker === symbol ? selection.candidate : undefined;
  const lastRunCandidate = useScreenerStore((state) => {
    // A workspace selection is authoritative, even when it deliberately has
    // no candidate snapshot (for example, a held position). Do not silently
    // replace that selection with an unrelated Last Run row.
    if (selection?.ticker === symbol) return undefined;
    return state.lastResult?.candidates.find((c) => c.ticker.toUpperCase() === symbol);
  });
  const candidate = selectedCandidate ?? lastRunCandidate;
  const benchmarkLabel = useScreenerStore((state) => {
    if (selection?.ticker === symbol) {
      if (selection.source === 'today_run') return state.todayRun?.result.benchmarkTicker ?? null;
      if (selection.source === 'last_run') return state.lastResult?.benchmarkTicker ?? null;
      return null;
    }
    return state.lastResult?.benchmarkTicker ?? null;
  });

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
      <Suspense fallback={<ChartLoadingFallback height={height} />}>
        <CandleChart {...sharedChartProps} width={width} height={height} />
      </Suspense>
      {fullscreen && (
        <ModalShell
          title={t('chart.fullscreen')}
          onClose={() => setFullscreen(false)}
          closeOnBackdrop={false}
          fullScreen
          contentClassName="p-4"
        >
          <ChartToolbar {...toolbarProps} />
          <Suspense fallback={<ChartLoadingFallback height={overlayHeight} />}>
            <CandleChart {...sharedChartProps} width={1280} height={overlayHeight} />
          </Suspense>
        </ModalShell>
      )}
    </div>
  );
}

export default CachedSymbolCandleChart;
