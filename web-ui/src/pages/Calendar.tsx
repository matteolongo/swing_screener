import { useMemo } from 'react';
import { t } from '@/i18n/t';
import { useCalendarEventsQuery } from '@/features/calendar/hooks';
import type { CalendarEvent, EventSourceTag } from '@/features/calendar/types';

const SOURCE_STYLES: Record<EventSourceTag, { dot: string; badge: string }> = {
  position: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  screener: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  economic: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
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
      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{event.title}</span>
      {event.ticker && (
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{event.ticker}</span>
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {formatDate(date)}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('calendarPage.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('calendarPage.subtitle')}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {(['position', 'screener', 'economic'] as EventSourceTag[]).map((tag) => (
          <div key={tag} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${SOURCE_STYLES[tag].dot}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t(`calendarPage.legend.${tag}` as any)}
            </span>
          </div>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('calendarPage.loadingText')}</p>
      )}
      {isError && (
        <p className="text-sm text-red-500">{t('calendarPage.errorText')}</p>
      )}
      {!isLoading && !isError && grouped.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('calendarPage.empty' as any, { days: '30' })}
        </p>
      )}
      {grouped.map(([date, events]) => (
        <DateGroup key={date} date={date} events={events} />
      ))}
    </div>
  );
}
