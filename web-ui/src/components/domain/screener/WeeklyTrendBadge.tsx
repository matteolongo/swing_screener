import { t } from '@/i18n/t';

interface WeeklyTrendBadgeProps {
  trend: 'up' | 'down' | 'neutral' | null | undefined;
  className?: string;
}

export default function WeeklyTrendBadge({ trend, className = '' }: WeeklyTrendBadgeProps) {
  if (trend == null) return null;

  const colorClass =
    trend === 'up'
      ? 'text-success bg-success/10 border-success/40'
      : trend === 'down'
        ? 'text-danger bg-danger/10 border-danger/40'
        : 'text-muted bg-foreground/5 border-border';

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
