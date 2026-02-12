import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

interface OverlayBadgeProps {
  status?: string | null;
  title?: string;
  className?: string;
}

const OVERLAY_BADGES: Record<string, { labelKey: MessageKey; className: string }> = {
  OK: { labelKey: 'recommendation.overlayBadge.ok' as MessageKey, className: 'bg-green-100 text-green-700' },
  REDUCED_RISK: { labelKey: 'recommendation.overlayBadge.reducedRisk' as MessageKey, className: 'bg-yellow-100 text-yellow-800' },
  REVIEW: { labelKey: 'recommendation.overlayBadge.review' as MessageKey, className: 'bg-orange-100 text-orange-800' },
  VETO: { labelKey: 'recommendation.overlayBadge.veto' as MessageKey, className: 'bg-red-100 text-red-800' },
  NO_DATA: { labelKey: 'recommendation.overlayBadge.noData' as MessageKey, className: 'bg-gray-100 text-gray-600' },
  OFF: { labelKey: 'recommendation.overlayBadge.off' as MessageKey, className: 'bg-gray-100 text-gray-600' },
};

export default function OverlayBadge({ status, title, className }: OverlayBadgeProps) {
  const safeStatus = status && status in OVERLAY_BADGES ? status : 'OFF';
  const badge = OVERLAY_BADGES[safeStatus];

  return (
    <span className={cn('text-xs px-2 py-1 rounded', badge.className, className)} title={title}>
      {t(badge.labelKey)}
    </span>
  );
}
