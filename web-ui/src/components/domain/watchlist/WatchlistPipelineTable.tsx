import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { useWatchlistPipeline } from '@/features/watchlist/hooks';
import type { WatchlistPipelineItem } from '@/features/watchlist/types';

function DistanceCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400">—</span>;
  const isBelow = pct < 0;
  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        isBelow ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400',
      )}
    >
      {pct > 0 ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  );
}

function SparklineCell({ prices }: { prices: number[] }) {
  if (prices.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <span className="font-mono text-xs text-gray-500 tabular-nums">
      {prices.map((p) => p.toFixed(2)).join(' › ')}
    </span>
  );
}

export default function WatchlistPipelineTable() {
  const { data: items, isLoading } = useWatchlistPipeline();

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-4">{t('common.table.loading')}</div>;
  }

  if (!items || items.length === 0) {
    return <div className="text-sm text-gray-500 py-4">{t('watchlistPipeline.empty')}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-gray-500 uppercase">
            <th className="pb-2 pr-4">{t('watchlistPipeline.columns.ticker')}</th>
            <th className="pb-2 pr-4">{t('watchlistPipeline.columns.signal')}</th>
            <th className="pb-2 pr-4 text-right">{t('watchlistPipeline.columns.currentPrice')}</th>
            <th className="pb-2 pr-4 text-right">{t('watchlistPipeline.columns.triggerPrice')}</th>
            <th className="pb-2 pr-4 text-right">{t('watchlistPipeline.columns.distance')}</th>
            <th className="pb-2">{t('watchlistPipeline.columns.sparkline')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: WatchlistPipelineItem) => (
            <tr
              key={item.ticker}
              className="border-b border-border/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td className="py-2 pr-4 font-medium">{item.ticker}</td>
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 capitalize">
                {item.signal && item.signal !== 'none'
                  ? item.signal
                  : t('watchlistPipeline.signalNone')}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {item.currentPrice != null ? item.currentPrice.toFixed(2) : '—'}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {item.triggerPrice != null ? item.triggerPrice.toFixed(2) : '—'}
              </td>
              <td className="py-2 pr-4 text-right">
                <DistanceCell pct={item.distancePct} />
              </td>
              <td className="py-2">
                <SparklineCell prices={item.sparkline} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
