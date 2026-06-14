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
 * Candlestick chart for full symbol views. Sources OHLCV bars + detected
 * patterns from the cached screener result by ticker (same store the sparkline
 * uses), so it renders without an extra fetch.
 */
export function CachedSymbolCandleChart({ ticker, className, width, height }: CachedSymbolCandleChartProps) {
  const symbol = ticker.toUpperCase();
  const bars = useScreenerStore(
    (state) =>
      state.lastResult?.candidates.find((c) => c.ticker.toUpperCase() === symbol)?.priceHistory ?? EMPTY_BARS,
  );
  const patterns = useScreenerStore(
    (state) =>
      state.lastResult?.candidates.find((c) => c.ticker.toUpperCase() === symbol)?.patterns ?? EMPTY_PATTERNS,
  );

  return (
    <CandleChart ticker={ticker} bars={bars} patterns={patterns} className={className} width={width} height={height} />
  );
}

export default CachedSymbolCandleChart;
