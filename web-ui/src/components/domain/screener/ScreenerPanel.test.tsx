import { describe, expect, it } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { t } from '@/i18n/t';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import ScreenerPanel, { currencyFilterToRequest } from './ScreenerPanel';

describe('currencyFilterToRequest', () => {
  it('does not force currencies when the filter is all', () => {
    expect(currencyFilterToRequest('all')).toBeUndefined();
  });

  it('maps explicit filters to request currencies', () => {
    expect(currencyFilterToRequest('usd')).toEqual(['USD']);
    expect(currencyFilterToRequest('eur')).toEqual(['EUR']);
  });
});

describe('ScreenerPanel', () => {
  it('defaults to the collapsed beginner run summary instead of the full advanced filter form', async () => {
    renderWithProviders(<ScreenerPanel />);

    expect(await screen.findByRole('button', { name: 'Advanced filters' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: t('screener.controls.actionFilter') })).not.toBeInTheDocument();
  });

  it('does not auto-select a candidate into the global drawer after a screener run completes', async () => {
    useWorkspaceStore.setState({ selectedTicker: null, selectedTickerSource: null });

    renderWithProviders(<ScreenerPanel />);

    const runButton = await screen.findByRole('button', { name: t('screener.controls.run') });
    fireEvent.click(runButton);

    await screen.findByText('AAPL');

    expect(useWorkspaceStore.getState().selectedTicker).toBeNull();
  });

  it('shows the real backend job phase while a run is in flight, without a fabricated step sequence', async () => {
    let statusCall = 0;
    server.use(
      http.post('*/api/screener/run', () =>
        HttpResponse.json({
          job_id: 'job-1',
          status: 'queued',
          created_at: '2026-06-09T00:00:00Z',
          updated_at: '2026-06-09T00:00:00Z',
        }, { status: 202 })
      ),
      http.get('*/api/screener/run/job-1', () => {
        statusCall += 1;
        const status = statusCall === 1 ? 'queued' : 'running';
        return HttpResponse.json({
          job_id: 'job-1',
          status,
          result: null,
          error: null,
          created_at: '2026-06-09T00:00:00Z',
          updated_at: '2026-06-09T00:00:00Z',
        });
      }),
    );

    renderWithProviders(<ScreenerPanel />);

    const runButton = await screen.findByRole('button', { name: t('screener.controls.run') });
    fireEvent.click(runButton);

    expect(await screen.findByText(t('screener.running.queued'), {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText(t('screener.running.running'), {}, { timeout: 3000 })).toBeInTheDocument();
  }, 10000);
});
