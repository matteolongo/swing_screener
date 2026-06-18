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
        'rounded border border-border px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-foreground/5 disabled:opacity-60'
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

