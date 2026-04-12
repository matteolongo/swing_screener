import EventsCalendar from '@/components/domain/calendar/EventsCalendar';
import { usePositions } from '@/features/portfolio/hooks';
import { useWatchlist } from '@/features/watchlist/hooks';

export default function CalendarPage() {
  const openPositionsQuery = usePositions('open');
  const watchlistQuery = useWatchlist();

  const calendarSymbols = [
    ...new Set([
      ...(openPositionsQuery.data ?? []).map((position) => position.ticker),
      ...(watchlistQuery.data ?? []).map((item) => item.ticker),
    ]),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Calendar Archive</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Archived research calendar. This route stays available directly but is no longer part of the primary navigation.
        </p>
      </div>
      <EventsCalendar symbols={calendarSymbols} daysAhead={30} />
    </div>
  );
}
