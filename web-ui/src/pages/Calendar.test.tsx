import { beforeEach, describe, it, expect } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/utils';
import Calendar from './Calendar';
import { t } from '@/i18n/t';
import { API_BASE_URL } from '@/lib/api';
import { server } from '@/test/mocks/server';
import { useScreenerStore } from '@/stores/screenerStore';
import { transformScreenerResponse } from '@/features/screener/types';
import { mockScreenerResults } from '@/test/mocks/handlers';

describe('Calendar page', () => {
  beforeEach(() => useScreenerStore.setState({ todayRun: null, todayRunInitialized: true }));

  it('keeps available events and retries incomplete sources', async () => {
    let requests = 0;
    server.use(http.get(`${API_BASE_URL}/api/calendar/events`, () => {
      requests += 1;
      return HttpResponse.json({
        events: [{ date: '2026-06-10', ticker: 'AAPL', event_type: 'earnings', title: 'AAPL Earnings', source_tag: 'position' }],
        days_ahead: 60,
        warnings: requests === 1 ? [{ event_type: 'economic', code: 'source_unavailable', tickers: [] }] : [],
      });
    }));
    const { user } = renderWithProviders(<Calendar />);
    expect(await screen.findByText(t('calendarPage.partialText'))).toBeVisible();
    expect(screen.getByText('AAPL Earnings')).toBeVisible();
    await user.click(screen.getByRole('button', { name: t('calendarPage.retry') }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(requests).toBe(2);
  });

  it('does not claim no events when a source is unavailable', async () => {
    server.use(http.get(`${API_BASE_URL}/api/calendar/events`, () => HttpResponse.json({
      events: [], days_ahead: 60,
      warnings: [{ event_type: 'economic', code: 'source_unavailable', tickers: [] }],
    })));
    renderWithProviders(<Calendar />);
    expect(await screen.findByText(t('calendarPage.unavailableText'))).toBeVisible();
    expect(screen.queryByText(t('calendarPage.empty', { days: '60' }))).not.toBeInTheDocument();
  });

  it('retries a failed request', async () => {
    let requests = 0;
    server.use(http.get(`${API_BASE_URL}/api/calendar/events`, () => {
      requests += 1;
      return requests === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ events: [], days_ahead: 60 });
    }));
    const { user } = renderWithProviders(<Calendar />);
    expect(await screen.findByText(t('calendarPage.errorText'))).toBeVisible();
    await user.click(screen.getByRole('button', { name: t('calendarPage.retry') }));
    expect(await screen.findByText(t('calendarPage.empty', { days: '60' }))).toBeVisible();
  });

  it('sends pinned candidates and refetches when their set changes', async () => {
    const requested: string[] = [];
    server.use(http.get(`${API_BASE_URL}/api/calendar/events`, ({ request }) => {
      requested.push(new URL(request.url).searchParams.get('candidate_tickers') ?? 'omitted');
      return HttpResponse.json({ events: [], days_ahead: 60 });
    }));
    const result = transformScreenerResponse(mockScreenerResults);
    const context = { request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' as const } };
    useScreenerStore.getState().recordTodayRun({ ...result, candidates: result.candidates.slice(0, 1) }, context);
    renderWithProviders(<Calendar />);
    await waitFor(() => expect(requested).toEqual([result.candidates[0].ticker]));
    act(() => useScreenerStore.getState().recordTodayRun({ ...result, candidates: [] }, context));
    await waitFor(() => expect(requested).toEqual([result.candidates[0].ticker, '']));
  });

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
