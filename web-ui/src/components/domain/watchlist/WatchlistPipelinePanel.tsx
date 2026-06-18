import { useMemo } from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';
import { useWatchlist } from '@/features/watchlist/hooks';
import type { WatchItem } from '@/features/watchlist/types';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatPercent } from '@/utils/formatters';

interface WatchlistPipelinePanelProps {
  onTickerSelect?: (ticker: string) => void;
}

function DistanceCell({ item }: { item: WatchItem }) {
  if (item.distanceToTriggerPct == null) {
    return <span className="text-sm text-muted">—</span>;
  }
  const distance = item.distanceToTriggerPct;
  const isBelow = distance <= 0;
  return (
    <div className="flex flex-col items-end">
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          isBelow ? 'text-warning' : 'text-success',
        )}
      >
        {isBelow
          ? t('watchlist.pipeline.distanceToBuyZone', { value: formatPercent(distance) })
          : t('watchlist.pipeline.aboveBuyZone', { value: formatPercent(distance) })}
      </span>
      {item.signalTriggerPrice != null ? (
        <span className="text-[11px] text-muted">
          {t('watchlist.pipeline.triggerPrice', {
            value: formatCurrency(item.signalTriggerPrice, item.currency ?? 'USD'),
          })}
        </span>
      ) : null}
    </div>
  );
}

function Sparkline({ item }: { item: WatchItem }) {
  const points = item.priceHistory ?? [];
  const polyline = useMemo(() => {
    if (points.length < 2) {
      return '';
    }
    const values = points.map((point) => point.close);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 56;
        const y = 20 - ((value - min) / range) * 16;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [points]);

  if (!polyline) {
    return <span className="text-xs text-muted">—</span>;
  }

  const first = points[0]?.close ?? 0;
  const last = points[points.length - 1]?.close ?? 0;
  const positive = last >= first;

  return (
    <svg viewBox="0 0 56 20" className="h-6 w-16 overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke={positive ? 'currentColor' : 'currentColor'}
        strokeWidth="1.75"
        points={polyline}
        className={positive ? 'text-success' : 'text-danger'}
      />
    </svg>
  );
}

export default function WatchlistPipelinePanel({ onTickerSelect }: WatchlistPipelinePanelProps) {
  const watchlistQuery = useWatchlist();
  const items = watchlistQuery.data ?? [];

  if (watchlistQuery.isLoading) {
    return <div className="py-10 text-sm text-muted">{t('watchlist.pipeline.loading')}</div>;
  }

  if (watchlistQuery.isError) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {t('watchlist.pipeline.error')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
        {t('watchlist.pipeline.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('watchlist.pipeline.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('watchlist.pipeline.subtitle')}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          <TrendingUp className="h-3.5 w-3.5" />
          {t('watchlist.pipeline.sortedByDistance')}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-foreground/5">
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">{t('watchlist.pipeline.columns.symbol')}</th>
              <th className="px-4 py-3 font-semibold">{t('watchlist.pipeline.columns.current')}</th>
              <th className="px-4 py-3 font-semibold">{t('watchlist.pipeline.columns.distance')}</th>
              <th className="px-4 py-3 font-semibold">{t('watchlist.pipeline.columns.sparkline')}</th>
              <th className="px-4 py-3 font-semibold">{t('watchlist.pipeline.columns.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {items.map((item) => (
              <tr
                key={item.ticker}
                className={cn(
                  'align-top transition-colors',
                  onTickerSelect ? 'cursor-pointer hover:bg-foreground/5' : '',
                )}
                onClick={() => onTickerSelect?.(item.ticker)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{item.ticker}</span>
                    {onTickerSelect ? <ArrowUpRight className="h-3.5 w-3.5 text-muted" /> : null}
                  </div>
                  <WatchMetaInline
                    watchedAt={item.watchedAt}
                    watchPrice={item.watchPrice}
                    currentPrice={item.currentPrice}
                    currency={item.currency}
                    className="mt-1 flex flex-wrap items-center gap-2 text-[11px]"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {item.currentPrice != null ? formatCurrency(item.currentPrice, item.currency ?? 'USD') : '—'}
                </td>
                <td className="px-4 py-3">
                  <DistanceCell item={item} />
                </td>
                <td className="px-4 py-3">
                  <Sparkline item={item} />
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-foreground/5 px-2 py-1 text-[11px] font-medium text-muted">
                    {(item.signal ?? 'none').toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
