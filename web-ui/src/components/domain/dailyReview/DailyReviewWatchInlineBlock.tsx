import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';
import WatchToggleButton from '@/components/domain/watchlist/WatchToggleButton';
import type { WatchItem } from '@/features/watchlist/types';

export interface DailyReviewWatchProps {
  watchItemsByTicker: Map<string, WatchItem>;
  watchPending: boolean;
  onWatch: (ticker: string, currentPrice: number | null | undefined, source: string) => void;
  onUnwatch: (ticker: string) => void;
}

interface WatchInlineBlockProps extends DailyReviewWatchProps {
  ticker: string;
  currentPrice: number | null | undefined;
  source: string;
}

export default function DailyReviewWatchInlineBlock({
  ticker,
  currentPrice,
  source,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: WatchInlineBlockProps) {
  const watchItem = watchItemsByTicker.get(ticker.trim().toUpperCase());
  return (
    <div className="mt-1 flex flex-col gap-1">
      <WatchToggleButton
        ticker={ticker}
        isWatched={Boolean(watchItem)}
        isPending={watchPending}
        onWatch={(nextTicker) => onWatch(nextTicker, currentPrice, source)}
        onUnwatch={onUnwatch}
      />
      {watchItem ? (
        <WatchMetaInline
          watchedAt={watchItem.watchedAt}
          watchPrice={watchItem.watchPrice}
          currentPrice={currentPrice}
          currency={null}
        />
      ) : null}
    </div>
  );
}
