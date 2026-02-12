import { cn } from '@/utils/cn';

interface OverlayBadgeProps {
  status?: string | null;
  title?: string;
  className?: string;
  labels?: Partial<Record<string, string>>;
}

const OVERLAY_BADGES: Record<string, { className: string }> = {
  OK: { className: 'bg-green-100 text-green-700' },
  REDUCED_RISK: { className: 'bg-yellow-100 text-yellow-800' },
  REVIEW: { className: 'bg-orange-100 text-orange-800' },
  VETO: { className: 'bg-red-100 text-red-800' },
  NO_DATA: { className: 'bg-gray-100 text-gray-600' },
  OFF: { className: 'bg-gray-100 text-gray-600' },
};

export default function OverlayBadge({ status, title, className, labels }: OverlayBadgeProps) {
  const safeStatus = status && status in OVERLAY_BADGES ? status : 'OFF';
  const badge = OVERLAY_BADGES[safeStatus];
  const label = labels?.[safeStatus] ?? safeStatus;

  return (
    <span className={cn('text-xs px-2 py-1 rounded', badge.className, className)} title={title}>
      {label}
    </span>
  );
}
