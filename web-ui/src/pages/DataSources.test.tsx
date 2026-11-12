import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, screen, waitFor } from '@testing-library/react';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import { queryKeys } from '@/lib/queryKeys';
import DataSources from './DataSources';

describe('DataSources page', () => {
  it('renders sources grouped by domain', async () => {
    server.use(
      http.get('*/api/datasources', () =>
        HttpResponse.json({
          sources: [
            { id: 'yfinance', display_name: 'Yahoo Finance', domain: 'market_data', role: 'primary',
              requires: null, configured: true, probeable: true, canary_market: 'us', note: null, last_probe: null },
            { id: 'company_ir_rss', display_name: 'Company IR RSS', domain: 'intelligence', role: 'primary',
              requires: null, configured: true, probeable: true, canary_market: null,
              note: null, last_probe: null },
            { id: 'finnhub', display_name: 'Finnhub', domain: 'fundamentals', role: 'enrichment',
              configured: true, probeable: true, last_probe: { id: 'finnhub', status: 'ok' } },
          ],
        }),
      ),
      http.get('*/api/datasources/events', () => HttpResponse.json({ events: [] })),
    );

    renderWithProviders(<DataSources />, { route: '/datasources' });

    expect(await screen.findByText('Yahoo Finance')).toBeInTheDocument();
    expect(await screen.findByText('Company IR RSS')).toBeInTheDocument();
    expect(screen.getByText(t('datasources.title'))).toBeInTheDocument();
    expect(screen.getByText(t('datasources.quoteProbeScope'))).toBeVisible();
  });

  it('shows a retryable error when Test all fails', async () => {
    server.use(
      http.post('*/api/datasources/probe', () =>
        HttpResponse.json({ detail: 'probe service unavailable' }, { status: 500 })),
    );
    const { user } = renderWithProviders(<DataSources />, { route: '/datasources' });
    await user.click(screen.getByRole('button', { name: t('datasources.testAll') }));

    expect(await screen.findByRole('alert')).toHaveTextContent('probe service unavailable');
  });

  it('retains fallback history when refreshing fails and updates it after retry', async () => {
    const fallback = {
      ts: '2026-11-10T19:00:00Z',
      domain: 'market_data',
      from_provider: 'alpaca',
      reason: 'provider timeout',
      fell_back_to: 'yfinance',
      tickers: ['AAPL'],
      stale_asof: null,
    };
    let failRefresh = false;
    let events = [fallback];
    server.use(http.get('*/api/datasources/events', () => failRefresh
      ? HttpResponse.json({}, { status: 503 })
      : HttpResponse.json({ events })));
    const { queryClient, user } = renderWithProviders(<DataSources />, { route: '/datasources' });
    expect(await screen.findByText(/provider timeout/)).toBeVisible();

    failRefresh = true;
    await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.datasourcesEvents() }));
    const alert = await screen.findByText(t('datasources.fallbacks.refreshError'));
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.getByText(/provider timeout/)).toBeVisible();

    failRefresh = false;
    events = [{ ...fallback, reason: 'provider rate limit' }];
    await user.click(screen.getByRole('button', { name: t('datasources.fallbacks.retry') }));
    expect(await screen.findByText(/provider rate limit/)).toBeVisible();
    await waitFor(() => expect(alert).not.toBeInTheDocument());
  });
});
