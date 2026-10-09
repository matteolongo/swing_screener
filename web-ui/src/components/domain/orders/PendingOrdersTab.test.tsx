import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import PendingOrdersTab from './PendingOrdersTab';
import { t } from '@/i18n/t';

const pendingOrder = {
  order_id: 'ORD-SBMO-001',
  ticker: 'SBMO',
  status: 'pending',
  order_type: 'LIMIT',
  order_kind: 'entry',
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
  isin: 'NL0010273215',
  thesis: null,
};

describe('PendingOrdersTab', () => {
  it.each(['draft', 'pending', 'submitted'])('cancels a %s order and keeps it visible in cancelled history', async (initialStatus) => {
    let status = initialStatus;
    server.use(
      http.get('*/api/portfolio/orders/local', ({ request }) => HttpResponse.json({
        orders: new URL(request.url).searchParams.get('status') === status ? [{ ...pendingOrder, status }] : [], asof: '2026-10-08',
      })),
      http.delete('*/api/portfolio/orders/ORD-SBMO-001', () => { status = 'cancelled'; return HttpResponse.json({ status, order_id: pendingOrder.order_id }); }),
    );
    const { user } = renderWithProviders(<PendingOrdersTab />);
    if (initialStatus !== 'pending') await user.click(await screen.findByRole('button', { name: t(`ordersPage.filter.${initialStatus}` as 'ordersPage.filter.draft') }));
    await user.click(await screen.findByRole('button', { name: t('pendingOrdersTab.cancelOrder') }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('pendingOrdersTab.cancelOrder') }));
    await waitFor(() => expect(screen.queryByText('SBMO')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: t('ordersPage.filter.cancelled') }));
    expect(await screen.findByText('SBMO')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('pendingOrdersTab.fillManually') })).not.toBeInTheDocument();
  });

  it('retains the order and displays a cancellation error for retry', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () => HttpResponse.json({ orders: [pendingOrder], asof: '2026-10-08' })),
      http.delete('*/api/portfolio/orders/ORD-SBMO-001', () => HttpResponse.json({ detail: 'Cancellation unavailable' }, { status: 503 })),
    );
    const { user } = renderWithProviders(<PendingOrdersTab />);
    await user.click(await screen.findByRole('button', { name: t('pendingOrdersTab.cancelOrder') }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('pendingOrdersTab.cancelOrder') }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancellation unavailable');
    expect(screen.getByText('SBMO')).toBeInTheDocument();
  });

  it('renders pending orders', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [pendingOrder], asof: '2026-04-27' })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(await screen.findByText('SBMO')).toBeInTheDocument();
    expect(await screen.findByText('200')).toBeInTheDocument();
  });

  it('renders empty state when no pending orders', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-27' })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(await screen.findByText(t('pendingOrdersTab.empty'))).toBeInTheDocument();
  });

  it('shows fill manually button', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [pendingOrder], asof: '2026-04-27' })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(
      await screen.findByRole('button', { name: t('pendingOrdersTab.fillManually') })
    ).toBeEnabled();
  });

  it('shows fill-via-degiro button when DeGiro connected', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [pendingOrder], asof: '2026-04-27' })
      ),
      http.get('*/api/portfolio/degiro/status', () =>
        HttpResponse.json({
          available: true,
          installed: true,
          credentials_configured: true,
          mode: 'ready',
          detail: '',
        })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(
      await screen.findByRole('button', { name: t('pendingOrdersTab.fillViaDegiro') })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: t('pendingOrdersTab.fillManually') })
    ).toBeEnabled();
  });

  it('disables fill-via-degiro button when DeGiro is unavailable', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [pendingOrder], asof: '2026-04-27' })
      ),
      http.get('*/api/portfolio/degiro/status', () =>
        HttpResponse.json({
          available: false,
          installed: false,
          credentials_configured: false,
          mode: 'missing_library',
          detail: 'degiro-connector is not installed.',
        })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(
      await screen.findByRole('button', { name: t('pendingOrdersTab.fillViaDegiro') })
    ).toBeDisabled();
  });
});
