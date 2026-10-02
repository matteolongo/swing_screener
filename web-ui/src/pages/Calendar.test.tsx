import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/utils';
import Calendar from './Calendar';
import { t } from '@/i18n/t';
import { API_BASE_URL } from '@/lib/api';
import { server } from '@/test/mocks/server';

describe('Calendar page', () => {
  it('renders page title', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText(t('calendarPage.title'))).toBeInTheDocument();
  });

  it('renders an earnings event for a position', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('AAPL Earnings')).toBeInTheDocument();
  });

  it('renders a screener earnings event', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('MSFT Earnings')).toBeInTheDocument();
  });

  it('renders an economic event', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('US CPI Release')).toBeInTheDocument();
  });

  it('shows source legend', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText(t('calendarPage.legend.position'))).toBeInTheDocument();
    expect(await screen.findByText(t('calendarPage.legend.screener'))).toBeInTheDocument();
    // 'Economic event' appears in both the legend and the event badge — use getAllByText
    const economicMatches = await screen.findAllByText(t('calendarPage.legend.economic'));
    expect(economicMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the IPO legend and formats dates with the provider locale', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/calendar/events`, () =>
        HttpResponse.json({
          events: [
            {
              date: '2025-10-01',
              ticker: 'ACME',
              event_type: 'ipo',
              title: 'ACME IPO',
              source_tag: 'ipo',
            },
          ],
          days_ahead: 60,
        }),
      ),
    );

    renderWithProviders(<Calendar />);

    expect(await screen.findByText(t('calendarPage.legend.ipo'))).toBeInTheDocument();
    expect(await screen.findByText('ACME IPO')).toBeInTheDocument();
    expect(screen.getByText('Wed, Oct 1')).toBeInTheDocument();
  });
});
