import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import type {
  CalendarEventsResponse,
  CalendarEventsResponseAPI,
} from '@/features/calendar/types';
import { transformCalendarEventsResponse } from '@/features/calendar/types';

export async function fetchCalendarEvents(
  daysAhead: number = 30,
): Promise<CalendarEventsResponse> {
  const url = `${apiUrl(API_ENDPOINTS.calendarEvents)}?days_ahead=${daysAhead}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Calendar events fetch failed: ${res.status}`);
  const data: CalendarEventsResponseAPI = await res.json();
  return transformCalendarEventsResponse(data);
}
