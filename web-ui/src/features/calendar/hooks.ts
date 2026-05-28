import { useQuery } from '@tanstack/react-query';
import { fetchCalendarEvents } from '@/features/calendar/api';
import type { CalendarEventsResponse } from '@/features/calendar/types';
import { queryKeys } from '@/lib/queryKeys';

export function useCalendarEventsQuery(daysAhead: number = 30) {
  return useQuery<CalendarEventsResponse>({
    queryKey: queryKeys.calendarEvents(daysAhead),
    queryFn: () => fetchCalendarEvents(daysAhead),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}
