import type { EventSourceTag } from '@/features/calendar/types';

export const SOURCE_STYLES: Record<EventSourceTag, { dot: string; badge: string }> = {
  position: {
    dot: 'bg-primary',
    badge: 'bg-primary/10 text-primary',
  },
  screener: {
    dot: 'bg-success',
    badge: 'bg-success/10 text-success',
  },
  economic: {
    dot: 'bg-warning',
    badge: 'bg-warning/10 text-warning',
  },
};

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
