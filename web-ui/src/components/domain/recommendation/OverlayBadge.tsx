import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';

interface OverlayBadgeProps {
  status?: string | null;
  title?: string;
  className?: string;
}

const OVERLAY_BADGES: Record<string, { className: string; labelKey: string }> = {
  OK: { className: 'bg-green-100 text-green-700', labelKey: 'recommendation.overlay.ok' },
  REDUCED_RISK: { className: 'bg-yellow-100 text-yellow-800', labelKey: 'recommendation.overlay.reducedRisk' },
  REVIEW: { className: 'bg-orange-100 text-orange-800', labelKey: 'recommendation.overlay.review' },
  VETO: { className: 'bg-red-100 text-red-800', labelKey: 'recommendation.overlay.veto' },
  PENDING: { className: 'bg-blue-100 text-blue-700', labelKey: 'recommendation.overlay.pending' },
  NO_DATA: { className: 'bg-gray-100 text-gray-600', labelKey: 'recommendation.overlay.noData' },
  OFF: { className: 'bg-gray-100 text-gray-600', labelKey: 'recommendation.overlay.off' },
};

export default function OverlayBadge({ status, title, className }: OverlayBadgeProps) {
  const safeStatus = status && status in OVERLAY_BADGES ? status : 'OFF';
  const badge = OVERLAY_BADGES[safeStatus];
  const label = t(badge.labelKey as any);

  return (
    <span className={cn('text-xs px-2 py-1 rounded', badge.className, className)} title={title}>
      {label}
    </span>
  );
}
