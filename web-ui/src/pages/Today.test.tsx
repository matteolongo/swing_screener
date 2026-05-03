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
});
