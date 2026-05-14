import { t } from '@/i18n/t';

interface WeeklyTrendBadgeProps {
  trend: 'up' | 'down' | 'neutral' | null | undefined;
  className?: string;
}

export default function WeeklyTrendBadge({ trend, className = '' }: WeeklyTrendBadgeProps) {
  if (trend == null) return null;

  const colorClass =
    trend === 'up'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-700'
      : trend === 'down'
        ? 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-700'
        : 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700';

  const label =
    trend === 'up'
      ? t('screener.details.weeklyTrend.up')
      : trend === 'down'
        ? t('screener.details.weeklyTrend.down')
        : t('screener.details.weeklyTrend.neutral');

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
