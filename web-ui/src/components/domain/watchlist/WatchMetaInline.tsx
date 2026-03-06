import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface WatchMetaInlineProps {
  watchedAt: string;
  watchPrice?: number | null;
  currentPrice?: number | null;
  currency?: string | null;
  className?: string;
}

function formatRelativeWatchTime(iso: string): string {
  const parsed = new Date(iso);
  const timestamp = parsed.getTime();
  if (!Number.isFinite(timestamp)) {
    return t('watchlist.since.unknown');
  }
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) {
    return t('watchlist.since.justNow');
  }
  if (deltaMs < 3_600_000) {
    return t('watchlist.since.minutesAgo', { value: Math.floor(deltaMs / 60_000) });
  }
  if (deltaMs < 86_400_000) {
    return t('watchlist.since.hoursAgo', { value: Math.floor(deltaMs / 3_600_000) });
  }
  return t('watchlist.since.daysAgo', { value: Math.floor(deltaMs / 86_400_000) });
}

function formatDeltaCurrency(value: number, currency?: string | null): string {
  const normalizedCurrency = String(currency ?? '').trim().toUpperCase();
  if (normalizedCurrency === 'EUR' || normalizedCurrency === 'USD') {
    const formatted = formatCurrency(Math.abs(value), normalizedCurrency);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  }
  const formatted = Math.abs(value).toFixed(2);
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function computeDelta(
  watchPrice?: number | null,
  currentPrice?: number | null,
  currency?: string | null,
): { text: string; colorClass: string } {
  if (
    watchPrice == null ||
    currentPrice == null ||
    !Number.isFinite(watchPrice) ||
    !Number.isFinite(currentPrice) ||
    watchPrice <= 0
  ) {
    return {
      text: t('watchlist.delta.unavailable'),
      colorClass: 'text-gray-500 dark:text-gray-400',
    };
  }
  const abs = currentPrice - watchPrice;
  const pct = (abs / watchPrice) * 100;
  if (abs > 0) {
    return {
      text: t('watchlist.delta.value', {
        abs: formatDeltaCurrency(abs, currency),
        pct: formatPercent(pct),
      }),
      colorClass: 'text-green-700 dark:text-green-300',
    };
  }
  if (abs < 0) {
    return {
      text: t('watchlist.delta.value', {
        abs: formatDeltaCurrency(abs, currency),
        pct: formatPercent(pct),
      }),
      colorClass: 'text-red-700 dark:text-red-300',
    };
  }
  return {
    text: t('watchlist.delta.value', {
      abs: formatDeltaCurrency(abs, currency),
      pct: formatPercent(pct),
    }),
    colorClass: 'text-gray-600 dark:text-gray-300',
  };
}

export default function WatchMetaInline({
  watchedAt,
  watchPrice,
  currentPrice,
  currency,
  className,
}: WatchMetaInlineProps) {
  const relative = formatRelativeWatchTime(watchedAt);
  const exact = formatDateTime(watchedAt);
  const delta = computeDelta(watchPrice, currentPrice, currency);

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2 text-[11px] leading-4'}>
      <span className="text-gray-500 dark:text-gray-400" title={exact}>
        {t('watchlist.since.label', { value: relative })}
      </span>
      <span className={delta.colorClass}>
        {t('watchlist.delta.label', { value: delta.text })}
      </span>
    </div>
  );
}

