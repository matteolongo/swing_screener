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
  close_position: 'border-l-4 border-danger/40',
  update_stop: 'border-l-4 border-warning/40',
  pending_orders: 'border-l-4 border-warning/40',
  watchlist_near_trigger: 'border-l-4 border-warning/40',
  best_candidate: 'border-l-4 border-primary/40',
  run_screener: 'border-l-4 border-border',
  no_action: 'border-l-4 border-border',
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
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">
          {t('todayPage.todayPriorityCard.title')}
        </span>
        <Badge variant={badgeVariant}>{kindLabel}</Badge>
      </div>

      {/* Headline */}
      <p className="text-base font-bold text-foreground leading-snug mb-1">
        {priority.headline}
      </p>

      {/* Reason */}
      <p className="text-sm text-muted mb-3">
        {priority.reason}
      </p>

      {/* Risk (if present) */}
      {priority.risk && (
        <div className="mb-3 rounded bg-warning/10 border border-warning/40 px-3 py-2">
          <span className="text-xs font-semibold text-warning uppercase tracking-wide">
            {t('todayPage.todayPriorityCard.risk')}
          </span>
          <p className="text-xs text-warning mt-0.5">{priority.risk}</p>
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
