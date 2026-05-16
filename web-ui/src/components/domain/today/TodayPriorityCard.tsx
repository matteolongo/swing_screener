// web-ui/src/components/domain/today/TodayPriorityCard.tsx

import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { TodayPriority, TodayPriorityKind } from '@/features/dailyReview/beginnerPriority';

interface TodayPriorityCardProps {
  priority: TodayPriority;
  onAction: () => void;
}

const KIND_BORDER: Record<TodayPriorityKind, string> = {
  close_position: 'border-l-4 border-red-500',
  update_stop: 'border-l-4 border-amber-500',
  pending_orders: 'border-l-4 border-amber-500',
  watchlist_near_trigger: 'border-l-4 border-amber-500',
  best_candidate: 'border-l-4 border-blue-500',
  run_screener: 'border-l-4 border-gray-300 dark:border-gray-600',
  no_action: 'border-l-4 border-gray-300 dark:border-gray-600',
};

const KIND_BADGE_VARIANT: Record<TodayPriorityKind, 'error' | 'warning' | 'primary' | 'default'> = {
  close_position: 'error',
  update_stop: 'warning',
  pending_orders: 'warning',
  watchlist_near_trigger: 'warning',
  best_candidate: 'primary',
  run_screener: 'default',
  no_action: 'default',
};

export default function TodayPriorityCard({ priority, onAction }: TodayPriorityCardProps) {
  const borderClass = KIND_BORDER[priority.kind];
  const badgeVariant = KIND_BADGE_VARIANT[priority.kind];
  const kindLabel = t(`todayPage.todayPriorityCard.kinds.${priority.kind}`);

  return (
    <Card
      variant="bordered"
      className={cn('p-4 rounded-lg', borderClass)}
    >
      {/* Header row: title label + kind chip */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t('todayPage.todayPriorityCard.title')}
        </span>
        <Badge variant={badgeVariant}>{kindLabel}</Badge>
      </div>

      {/* Headline */}
      <p className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1">
        {priority.headline}
      </p>

      {/* Reason */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {priority.reason}
      </p>

      {/* Risk (if present) */}
      {priority.risk && (
        <div className="mb-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
            {t('todayPage.todayPriorityCard.risk')}
          </span>
          <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">{priority.risk}</p>
        </div>
      )}

      {/* Action button */}
      <Button
        variant="primary"
        size="sm"
        onClick={onAction}
        className="w-full sm:w-auto"
      >
        {priority.actionLabel}
      </Button>
    </Card>
  );
}
