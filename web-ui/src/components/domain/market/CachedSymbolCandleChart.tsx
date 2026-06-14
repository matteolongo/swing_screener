import type { CandlePattern, PriceHistoryPoint } from '@/features/screener/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { CandleChart } from './CandleChart';

interface CachedSymbolCandleChartProps {
  ticker: string;
  className?: string;
  width?: number;
  height?: number;
}

const EMPTY_BARS: PriceHistoryPoint[] = [];
const EMPTY_PATTERNS: CandlePattern[] = [];

/**
 * Candlestick chart for full symbol views. Sources OHLCV bars, detected patterns,
 * and the benchmark comparison series from the cached screener result by ticker
 * (same store the sparkline used), so it renders without an extra fetch.
 */
export function CachedSymbolCandleChart({ ticker, className, width, height }: CachedSymbolCandleChartProps) {
  const symbol = ticker.toUpperCase();
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((c) => c.ticker.toUpperCase() === symbol),
  );
  const benchmarkLabel = useScreenerStore((state) => state.lastResult?.benchmarkTicker ?? null);

  return (
    <CandleChart
      ticker={ticker}
      bars={candidate?.priceHistory ?? EMPTY_BARS}
      patterns={candidate?.patterns ?? EMPTY_PATTERNS}
      benchmarkBars={candidate?.benchmarkPriceHistory ?? EMPTY_BARS}
      benchmarkLabel={benchmarkLabel}
      outperformancePct={candidate?.benchmarkOutperformancePct ?? null}
      className={className}
      width={width}
      height={height}
    />
  );
}

export default CachedSymbolCandleChart;
