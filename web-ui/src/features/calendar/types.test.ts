import { describe, expect, it } from 'vitest';

import { transformCalendarEvent } from './types';

describe('calendar transforms', () => {
  it('maps enriched event metadata and current event literals', () => {
    const event = transformCalendarEvent({
      date: '2026-06-10',
      ticker: 'AAPL',
      event_type: 'ipo',
      title: 'New listing',
      source_tag: 'ipo',
      provider: 'finnhub',
      confidence: 0.8,
      source_url: 'https://example.test/calendar',
      eps_estimate: 1.2,
      eps_actual: 1.4,
    });

    expect(event.eventType).toBe('ipo');
    expect(event.sourceTag).toBe('ipo');
    expect(event.provider).toBe('finnhub');
    expect(event.confidence).toBe(0.8);
    expect(event.sourceUrl).toBe('https://example.test/calendar');
    expect(event.epsEstimate).toBe(1.2);
    expect(event.epsActual).toBe(1.4);
  });
});
