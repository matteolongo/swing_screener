import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/mocks/server';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { t } from '@/i18n/t';
import PoolTab from './PoolTab';

const tabName = (key: Parameters<typeof t>[0], count: number) => `${t(key)} (${count})`;

describe('PoolTab', () => {
  beforeEach(() => {
    // The enrich hook persists its job id; isolate tests from each other.
    localStorage.clear();
  });

  it('rebuilds the pool and renders the structural diff', async () => {
    server.use(
      http.post('*/api/pool/rebuild', () =>
        HttpResponse.json({
          applied: true,
          additions: [{ symbol: 'NVDA', region: 'us', index_memberships: ['us_sp500'] }],
          removals: [{ symbol: 'TWTR', region: 'us', index_memberships: ['us_sp500'] }],
          modifications: [
            {
              symbol: 'AAPL',
              changes: [
                { field: 'index_memberships', before: ['us_sp500'], after: ['us_sp500', 'us_nasdaq100'] },
              ],
            },
          ],
          summary: { added: 1, removed: 1, modified: 1, unchanged: 500 },
        }),
      ),
    );

    const { user } = renderWithProviders(<PoolTab />);
    await user.click(screen.getByRole('button', { name: t('poolAdmin.rebuild.button') }));

    await waitFor(() =>
      expect(screen.getByText(t('poolAdmin.rebuild.added', { count: 1 }))).toBeInTheDocument(),
    );
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });

  it('refreshes all universes and renders the per-universe summary', async () => {
    server.use(
      http.post('*/api/universes/refresh-all', () =>
        HttpResponse.json({
          universes: [
            {
              id: 'us_sp500',
              applied: true,
              changed: true,
              current_member_count: 503,
              proposed_member_count: 504,
              additions: ['SMCI'],
              removals: [],
            },
          ],
          total_additions: 1,
          total_removals: 0,
          total_changed: 1,
          skipped_auto: 0,
        }),
      ),
    );

    const { user } = renderWithProviders(<PoolTab />);
    await user.click(screen.getByRole('button', { name: t('poolAdmin.refreshAll.button') }));

    await waitFor(() => expect(screen.getByText('us_sp500')).toBeInTheDocument());
    expect(screen.getByText('SMCI')).toBeInTheDocument();
  });

  it('enriches taxonomy and renders the diff when the job completes', async () => {
    server.use(
      http.post('*/api/pool/enrich', () => HttpResponse.json({ job_id: 'job-1' })),
      http.get('*/api/pool/enrich/job-1', () =>
        HttpResponse.json({
          status: 'done',
          progress: { processed: 2, total: 2, failed: 1 },
          error: null,
          diff: {
            modified: [
              { symbol: 'TSLA', changes: [{ field: 'sector', before: 'Auto', after: 'Tech' }] },
            ],
            failed_symbols: ['0700.HK'],
          },
        }),
      ),
    );

    const { user } = renderWithProviders(<PoolTab />);
    await user.click(screen.getByRole('button', { name: t('poolAdmin.enrich.button') }));

    await waitFor(() => expect(screen.getByText('TSLA')).toBeInTheDocument());
    expect(
      screen.getByRole('button', { name: tabName('poolAdmin.diff.failed', 1) }),
    ).toBeInTheDocument();
  });
});
