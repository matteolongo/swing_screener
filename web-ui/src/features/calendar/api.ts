import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import type {
  CalendarEventsResponse,
  CalendarEventsResponseAPI,
} from '@/features/calendar/types';
import { transformCalendarEventsResponse } from '@/features/calendar/types';

export async function fetchCalendarEvents(
  daysAhead: number = 30,
): Promise<CalendarEventsResponse> {
  const data = await fetchJson<CalendarEventsResponseAPI>(
    `${API_ENDPOINTS.calendarEvents}?days_ahead=${daysAhead}`,
    { errorMessage: 'Calendar events fetch failed' },
  );
  return transformCalendarEventsResponse(data);
}
