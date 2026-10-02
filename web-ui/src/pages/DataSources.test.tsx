import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
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
          ],
        }),
      ),
      http.get('*/api/datasources/events', () => HttpResponse.json({ events: [] })),
    );

    renderWithProviders(<DataSources />, { route: '/datasources' });

    expect(await screen.findByText('Yahoo Finance')).toBeInTheDocument();
    expect(await screen.findByText('Company IR RSS')).toBeInTheDocument();
    expect(screen.getByText(t('datasources.title'))).toBeInTheDocument();
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
});
