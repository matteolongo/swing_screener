import { Link } from 'react-router-dom';
import CollapsibleCard from '@/components/common/CollapsibleCard';
import { useCalendarEventsQuery } from '@/features/calendar/hooks';
import type { CalendarEvent, EventSourceTag } from '@/features/calendar/types';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

// Mirrors Calendar page's SOURCE_STYLES dot colors (not exported there).
const SOURCE_DOT: Record<EventSourceTag, string> = {
  position: 'bg-primary',
  screener: 'bg-success',
  economic: 'bg-warning',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function groupByDate(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.date) ?? [];
    list.push(event);
    map.set(event.date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => Number(b.sourceTag === 'position') - Number(a.sourceTag === 'position'));
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function CalendarPeekCard() {
  const { data } = useCalendarEventsQuery(7);
  const groups = groupByDate(data?.events ?? []);

  return (
    <CollapsibleCard id="today.calendar" title={t('todayPage.calendarPeek.title')}>
      {groups.length === 0 ? (
        <p className="text-xs text-muted">{t('todayPage.calendarPeek.empty')}</p>
      ) : (
        <div className="space-y-2">
          {groups.map(([date, events]) => (
            <div key={date}>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {formatDate(date)}
              </div>
              {events.map((event, i) => (
                <div key={`${date}-${i}`} className="flex items-center gap-2 py-0.5 text-[13px]">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', SOURCE_DOT[event.sourceTag])} />
                  <span className="flex-1 truncate text-foreground">{event.title}</span>
                  {event.ticker && <span className="shrink-0 font-mono text-xs text-muted">{event.ticker}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <Link to="/calendar" className="mt-2 inline-block text-xs text-primary hover:underline">
        {t('todayPage.calendarPeek.viewAll')}
      </Link>
    </CollapsibleCard>
  );
}
