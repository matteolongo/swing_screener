import { formatCurrency, formatDateTime, formatPercent, relativeTimeParts } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface WatchMetaInlineProps {
  watchedAt: string;
  watchPrice?: number | null;
  currentPrice?: number | null;
  currency?: string | null;
  className?: string;
}

function formatRelativeWatchTime(iso: string): string {
  const parts = relativeTimeParts(iso);
  switch (parts.kind) {
    case 'unknown': return t('watchlist.since.unknown');
    case 'justNow': return t('watchlist.since.justNow');
    case 'minutes': return t('watchlist.since.minutesAgo', { value: parts.value });
    case 'hours': return t('watchlist.since.hoursAgo', { value: parts.value });
    case 'days': return t('watchlist.since.daysAgo', { value: parts.value });
  }
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
      colorClass: 'text-muted',
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
      colorClass: 'text-success',
    };
  }
  if (abs < 0) {
    return {
      text: t('watchlist.delta.value', {
        abs: formatDeltaCurrency(abs, currency),
        pct: formatPercent(pct),
      }),
      colorClass: 'text-danger',
    };
  }
  return {
    text: t('watchlist.delta.value', {
      abs: formatDeltaCurrency(abs, currency),
      pct: formatPercent(pct),
    }),
    colorClass: 'text-muted',
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
      <span className="text-muted" title={exact}>
        {t('watchlist.since.label', { value: relative })}
      </span>
      <span className={delta.colorClass}>
        {t('watchlist.delta.label', { value: delta.text })}
      </span>
    </div>
  );
}

