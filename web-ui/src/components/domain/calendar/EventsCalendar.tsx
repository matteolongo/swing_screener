import { useIntelligenceUpcomingCatalystsQuery } from '@/features/intelligence/hooks';
import type { IntelligenceUpcomingCatalyst } from '@/features/intelligence/types';

interface EventsCalendarProps {
  symbols: string[];
  daysAhead?: number;
}

function eventTypeBadgeClass(eventType: string): string {
  const type = eventType.toLowerCase();
  if (type.includes('earning')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (type.includes('dividend')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (type.includes('split')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function groupByDate(items: IntelligenceUpcomingCatalyst[]): Map<string, IntelligenceUpcomingCatalyst[]> {
  const map = new Map<string, IntelligenceUpcomingCatalyst[]>();
  for (const item of items) {
    const key = item.eventAt ? item.eventAt.slice(0, 10) : 'Unknown date';
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

export default function EventsCalendar({ symbols, daysAhead = 30 }: EventsCalendarProps) {
  const catalystsQuery = useIntelligenceUpcomingCatalystsQuery(
    undefined,
    symbols,
    daysAhead,
    symbols.length > 0
  );

  if (symbols.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500">
        No positions or watchlist items to track
      </div>
    );
  }

  if (catalystsQuery.isLoading) {
    return (
      <div className="text-sm text-gray-500 py-4">Loading upcoming catalysts…</div>
    );
  }

  if (catalystsQuery.isError) {
    return (
      <div className="text-sm text-rose-600 py-4">Failed to load upcoming catalysts.</div>
    );
  }

  const items = catalystsQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500">
        No upcoming catalysts found for the next {daysAhead} days.
      </div>
    );
  }

  const grouped = groupByDate(items);
  const sortedDates = Array.from(grouped.keys()).sort();

  return (
    <div className="space-y-4">
      {sortedDates.map((dateStr) => {
        const dayItems = grouped.get(dateStr) ?? [];
        const displayDate = dateStr !== 'Unknown date'
          ? new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          : 'Unknown date';

        return (
          <div key={dateStr} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{displayDate}</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {dayItems.map((item, i) => (
                <li key={i} className="px-3 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 w-12 flex-shrink-0">
                    {item.symbol}
                  </span>
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${eventTypeBadgeClass(item.eventType)}`}
                  >
                    {item.eventType || 'Other'}
                  </span>
                  {item.eventSubtype && item.eventSubtype !== item.eventType ? (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {item.eventSubtype}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
