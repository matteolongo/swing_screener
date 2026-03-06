import { t } from '@/i18n/t';

interface WatchToggleButtonProps {
  ticker: string;
  isWatched: boolean;
  isPending?: boolean;
  onWatch: (ticker: string) => void;
  onUnwatch: (ticker: string) => void;
  className?: string;
}

export default function WatchToggleButton({
  ticker,
  isWatched,
  isPending = false,
  onWatch,
  onUnwatch,
  className,
}: WatchToggleButtonProps) {
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(event) => {
        event.stopPropagation();
        if (isWatched) {
          onUnwatch(ticker);
          return;
        }
        onWatch(ticker);
      }}
      className={
        className ??
        'rounded border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
      }
      title={isWatched ? t('watchlist.actions.unwatch') : t('watchlist.actions.watch')}
      aria-label={isWatched ? t('watchlist.actions.unwatchAria', { ticker }) : t('watchlist.actions.watchAria', { ticker })}
    >
      {isPending
        ? t('watchlist.actions.working')
        : isWatched
          ? t('watchlist.actions.unwatch')
          : t('watchlist.actions.watch')}
    </button>
  );
}

