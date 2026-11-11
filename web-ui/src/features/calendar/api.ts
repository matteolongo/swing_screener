import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import type {
  CalendarEventsResponse,
  CalendarEventsResponseAPI,
} from '@/features/calendar/types';
import { transformCalendarEventsResponse } from '@/features/calendar/types';

export async function fetchCalendarEvents(
  daysAhead: number = 30,
  candidateTickers?: string[],
): Promise<CalendarEventsResponse> {
  const params = new URLSearchParams({ days_ahead: String(daysAhead) });
  if (candidateTickers !== undefined) params.set('candidate_tickers', candidateTickers.join(','));
  const data = await fetchJson<CalendarEventsResponseAPI>(
    `${API_ENDPOINTS.calendarEvents}?${params}`,
    { errorMessage: 'Calendar events fetch failed' },
  );
  return transformCalendarEventsResponse(data);
}
