import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
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

  it('renders "Requires Action" section before "Watchlist nearing trigger" section when both are present', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-04' })
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
          positions_close: [
            {
              position_id: 'pos-NVDA-001',
              ticker: 'NVDA',
              entry_price: 150,
              stop_price: 140,
              current_price: 138,
              r_now: -1.2,
              days_open: 5,
              time_stop_warning: false,
              reason: 'Price broke below stop',
            },
          ],
          summary: {
            total_positions: 1,
            no_action: 0,
            update_stop: 0,
            close_positions: 1,
            new_candidates: 0,
            add_on_candidates: 0,
            watchlist_near_trigger: 1,
            review_date: '2026-05-04',
          },
        })
      )
    );

    renderWithProviders(<Today />);

    // Wait for both sections to appear
    const requiresActionEl = await screen.findByText(new RegExp(t('todayPage.actionList.requiresAction'), 'i'));
    const watchlistEl = screen.getByText(new RegExp(t('watchlist.pipeline.dailyReviewTitle'), 'i'));

    // "Requires Action" must come before "Watchlist nearing trigger" in the DOM
    expect(
      requiresActionEl.compareDocumentPosition(watchlistEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('action filter dropdown shows human-readable labels, not raw enum strings', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-04' })
      ),
    );

    renderWithProviders(<Today />);

    // Wait for the filter bar to render (it renders once daily-review responds)
    await screen.findByRole('combobox');
    const select = screen.getByRole('combobox');
    const options = within(select).getAllByRole('option');
    const labels = options.map((o) => o.textContent ?? '');

    // Should use readable labels from i18n
    expect(labels).toContain(t('screener.guidedList.action.BUY_NOW'));
    expect(labels).toContain(t('screener.guidedList.action.BUY_ON_PULLBACK'));
    expect(labels).toContain(t('screener.guidedList.action.WATCH'));

    // Must NOT leak raw enum strings
    expect(labels).not.toContain('BUY_NOW');
    expect(labels).not.toContain('BUY_ON_PULLBACK');
    expect(labels).not.toContain('WATCH');
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
