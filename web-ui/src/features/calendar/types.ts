export type EventSourceTag = 'position' | 'screener' | 'economic';
export type EventType = 'earnings' | 'economic';

export interface CalendarEventAPI {
  date: string;
  ticker: string | null;
  event_type: EventType;
  title: string;
  source_tag: EventSourceTag;
}

export interface CalendarEventsResponseAPI {
  events: CalendarEventAPI[];
  days_ahead: number;
}

export interface CalendarEvent {
  date: string;
  ticker: string | null;
  eventType: EventType;
  title: string;
  sourceTag: EventSourceTag;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  daysAhead: number;
}

export function transformCalendarEvent(api: CalendarEventAPI): CalendarEvent {
  return {
    date: api.date,
    ticker: api.ticker,
    eventType: api.event_type,
    title: api.title,
    sourceTag: api.source_tag,
  };
}

export function transformCalendarEventsResponse(
  api: CalendarEventsResponseAPI,
): CalendarEventsResponse {
  return {
    events: api.events.map(transformCalendarEvent),
    daysAhead: api.days_ahead,
  };
}
