import { useQuery } from '@tanstack/react-query';
import { fetchCalendarEvents } from '@/features/calendar/api';
import type { CalendarEventsResponse } from '@/features/calendar/types';
import { queryKeys } from '@/lib/queryKeys';

export function useCalendarEventsQuery(daysAhead: number = 30, candidateTickers?: string[]) {
  const tickers = candidateTickers === undefined
    ? undefined
    : [...new Set(candidateTickers.map((ticker) => ticker.trim().toUpperCase()))].sort();
  return useQuery<CalendarEventsResponse>({
    queryKey: queryKeys.calendarEvents(daysAhead, tickers),
    queryFn: () => fetchCalendarEvents(daysAhead, tickers),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}
