export type EventSourceTag = 'position' | 'screener' | 'economic' | 'ipo';
export type EventType = 'earnings' | 'economic' | 'ipo' | 'dividend';

export interface CalendarEventAPI {
  date: string;
  ticker: string | null;
  event_type: EventType;
  title: string;
  source_tag: EventSourceTag;
  provider?: string | null;
  confidence?: number | null;
  source_url?: string | null;
  eps_estimate?: number | null;
  eps_actual?: number | null;
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
  provider: string | null;
  confidence: number | null;
  sourceUrl: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
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
    provider: api.provider ?? null,
    confidence: api.confidence ?? null,
    sourceUrl: api.source_url ?? null,
    epsEstimate: api.eps_estimate ?? null,
    epsActual: api.eps_actual ?? null,
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
