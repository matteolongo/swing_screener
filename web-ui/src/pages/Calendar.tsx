import { useMemo } from 'react';
import { t } from '@/i18n/t';
import { useCalendarEventsQuery } from '@/features/calendar/hooks';
import type { CalendarEvent, EventSourceTag } from '@/features/calendar/types';

const SOURCE_STYLES: Record<EventSourceTag, { dot: string; badge: string }> = {
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function EventRow({ event }: { event: CalendarEvent }) {
  const styles = SOURCE_STYLES[event.sourceTag];
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />
      <span className="flex-1 text-sm text-foreground">{event.title}</span>
      {event.ticker && (
        <span className="text-xs font-mono text-muted">{event.ticker}</span>
      )}
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>
        {t(`calendarPage.legend.${event.sourceTag}` as any)}
      </span>
    </div>
  );
}

function DateGroup({ date, events }: { date: string; events: CalendarEvent[] }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {formatDate(date)}
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
        {events.map((e, i) => (
          <EventRow key={`${e.date}-${e.ticker ?? 'eco'}-${i}`} event={e} />
        ))}
      </div>
    </div>
  );
}

export default function Calendar() {
  const { data, isLoading, isError } = useCalendarEventsQuery(30);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data.events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          {t('calendarPage.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('calendarPage.subtitle')}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {(['position', 'screener', 'economic'] as EventSourceTag[]).map((tag) => (
          <div key={tag} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${SOURCE_STYLES[tag].dot}`} />
            <span className="text-xs text-muted">
              {t(`calendarPage.legend.${tag}` as any)}
            </span>
          </div>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-muted">{t('calendarPage.loadingText')}</p>
      )}
      {isError && (
        <p className="text-sm text-danger">{t('calendarPage.errorText')}</p>
      )}
      {!isLoading && !isError && grouped.length === 0 && (
        <p className="text-sm text-muted">
          {t('calendarPage.empty' as any, { days: '30' })}
        </p>
      )}
      {grouped.map(([date, events]) => (
        <DateGroup key={date} date={date} events={events} />
      ))}
    </div>
  );
}
