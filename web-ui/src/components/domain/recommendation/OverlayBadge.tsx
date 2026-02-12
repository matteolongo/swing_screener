import { cn } from '@/utils/cn';

interface OverlayBadgeProps {
  status?: string | null;
  title?: string;
  className?: string;
}

const OVERLAY_BADGES: Record<string, { label: string; className: string }> = {
  OK: { label: 'OK', className: 'bg-green-100 text-green-700' },
  REDUCED_RISK: { label: 'Reduced', className: 'bg-yellow-100 text-yellow-800' },
  REVIEW: { label: 'Review', className: 'bg-orange-100 text-orange-800' },
  VETO: { label: 'Veto', className: 'bg-red-100 text-red-800' },
  NO_DATA: { label: 'No Data', className: 'bg-gray-100 text-gray-600' },
  OFF: { label: 'Off', className: 'bg-gray-100 text-gray-600' },
};

export default function OverlayBadge({ status, title, className }: OverlayBadgeProps) {
  const safeStatus = status && status in OVERLAY_BADGES ? status : 'OFF';
  const badge = OVERLAY_BADGES[safeStatus];

  return (
    <span className={cn('text-xs px-2 py-1 rounded', badge.className, className)} title={title}>
      {badge.label}
    </span>
  );
}
