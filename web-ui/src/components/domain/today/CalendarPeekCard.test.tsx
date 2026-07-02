import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import CalendarPeekCard from './CalendarPeekCard';
import type { CalendarEventsResponse } from '@/features/calendar/types';

let mockData: CalendarEventsResponse | undefined;

vi.mock('@/features/calendar/hooks', () => ({
  useCalendarEventsQuery: () => ({ data: mockData }),
}));

beforeEach(() => {
  mockData = { events: [], daysAhead: 7 };
});

describe('CalendarPeekCard', () => {
  it('shows one muted line when there are no upcoming events', () => {
    renderWithProviders(<CalendarPeekCard />);
    expect(screen.getByText(t('todayPage.calendarPeek.empty'))).toBeInTheDocument();
  });

  it('groups events by date and lists position-sourced events before others on the same day', () => {
    mockData = {
      daysAhead: 7,
      events: [
        { date: '2026-06-10', ticker: 'MSFT', eventType: 'earnings', title: 'MSFT Earnings', sourceTag: 'screener' },
        { date: '2026-06-10', ticker: null, eventType: 'economic', title: 'US CPI Release', sourceTag: 'economic' },
        { date: '2026-06-10', ticker: 'AAPL', eventType: 'earnings', title: 'AAPL Earnings', sourceTag: 'position' },
      ],
    };
    renderWithProviders(<CalendarPeekCard />);
    const titles = screen.getAllByText(/Earnings|CPI/).map((el) => el.textContent);
    expect(titles).toEqual(['AAPL Earnings', 'MSFT Earnings', 'US CPI Release']);
  });

  it('groups events under separate date headers', () => {
    mockData = {
      daysAhead: 7,
      events: [
        { date: '2026-06-10', ticker: 'AAPL', eventType: 'earnings', title: 'AAPL Earnings', sourceTag: 'position' },
        { date: '2026-06-12', ticker: 'MSFT', eventType: 'earnings', title: 'MSFT Earnings', sourceTag: 'screener' },
      ],
    };
    renderWithProviders(<CalendarPeekCard />);
    expect(screen.getByText('AAPL Earnings')).toBeInTheDocument();
    expect(screen.getByText('MSFT Earnings')).toBeInTheDocument();
  });

  it('links to the full calendar page', () => {
    renderWithProviders(<CalendarPeekCard />);
    const link = screen.getByRole('link', { name: t('todayPage.calendarPeek.viewAll') });
    expect(link).toHaveAttribute('href', '/calendar');
  });

  it('keeps the card header visible after collapsing', () => {
    renderWithProviders(<CalendarPeekCard />);
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.getByText(t('todayPage.calendarPeek.title'))).toBeInTheDocument();
  });
});
