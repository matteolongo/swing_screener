import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import Today from './Today';

describe('Today page — pending orders badge', () => {
  it('shows pending orders badge when orders exist', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({
          orders: [{
            order_id: 'ORD-SBMO-001',
            ticker: 'SBMO',
            status: 'pending',
            order_kind: 'entry',
            order_type: 'LIMIT',
            quantity: 200,
            limit_price: 12.50,
            stop_price: 11.20,
            order_date: '2026-04-25',
            filled_date: null,
            entry_price: null,
            notes: '',
            parent_order_id: null,
            position_id: null,
            tif: 'GTC',
            fee_eur: null,
            fill_fx_rate: null,
          }],
          asof: '2026-04-28',
        })
      )
    );
    renderWithProviders(<Today />);
    expect(
      await screen.findByText(t('todayPage.pendingBadge.singular', { count: '1' }))
    ).toBeInTheDocument();
  });

  it('hides pending orders badge when no orders', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-28' })
      )
    );
    renderWithProviders(<Today />);
    await screen.findByRole('heading').catch(() => null); // wait for render
    expect(
      screen.queryByText(t('todayPage.pendingBadge.singular', { count: '1' }))
    ).not.toBeInTheDocument();
  });

  it('shows watchlist near-trigger section when daily review returns matches', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-28' })
      ),
      http.get('*/api/daily-review', () =>
        HttpResponse.json({
          watchlist_near_trigger: [
            {
              ticker: 'ASML',
              watched_at: '2026-05-01T10:00:00Z',
              watch_price: 660,
              currency: 'EUR',
              source: 'screener',
              current_price: 671,
              signal_trigger_price: 680,
              distance_to_trigger_pct: -1.3,
              price_history: [],
            },
          ],
          new_candidates: [],
          positions_add_on_candidates: [],
          positions_hold: [],
          positions_update_stop: [],
          positions_close: [],
          summary: {
            total_positions: 0,
            no_action: 0,
            update_stop: 0,
            close_positions: 0,
            new_candidates: 0,
            add_on_candidates: 0,
            watchlist_near_trigger: 1,
            review_date: '2026-05-04',
          },
        })
      )
    );

    renderWithProviders(<Today />);
    expect(await screen.findByText(new RegExp(t('watchlist.pipeline.dailyReviewTitle'), 'i'))).toBeInTheDocument();
    expect(screen.getByText('ASML')).toBeInTheDocument();
  });
});
