import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import FillViaDegiroModal from './FillViaDegiroModal';
import { t } from '@/i18n/t';
import type { Order } from '@/types/order';

const order: Order = {
  orderId: 'ORD-SBMO-001',
  ticker: 'SBMO',
  status: 'pending',
  orderType: 'LIMIT',
  orderKind: 'entry',
  quantity: 200,
  limitPrice: 12.50,
  stopPrice: 11.20,
  orderDate: '2026-04-25',
  filledDate: '',
  entryPrice: null,
  notes: '',
  parentOrderId: null,
  positionId: null,
  tif: 'GTC',
};

const degiroOrders = [
  {
    order_id: 'DG-BUY-1',
    product_id: '9876',
    isin: 'NL0010273215',
    product_name: 'SBMO Offshore',
    status: 'confirmed',
    price: 12.34,
    quantity: 200,
    side: 'buy',
    created_at: '2026-04-26',
  },
];

describe('FillViaDegiroModal', () => {
  it('shows loading state while fetching', () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', async () => {
        await new Promise<void>(() => {}); // never resolves
        return HttpResponse.json({ orders: [] });
      })
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    expect(screen.getByText(t('fillViaDegiroModal.loading'))).toBeInTheDocument();
  });

  it('renders DeGiro order list', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: degiroOrders, asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    expect(await screen.findByText('SBMO Offshore')).toBeInTheDocument();
    expect(await screen.findByText('12.34')).toBeInTheDocument();
  });

  it('confirm button disabled until row selected', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: degiroOrders, asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    const btn = await screen.findByRole('button', { name: t('fillViaDegiroModal.confirmButton') });
    expect(btn).toBeDisabled();
  });

  it('enables confirm button after selecting a row', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: degiroOrders, asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    const row = await screen.findByText('SBMO Offshore');
    fireEvent.click(row.closest('tr')!);
    const btn = screen.getByRole('button', { name: t('fillViaDegiroModal.confirmButton') });
    expect(btn).toBeEnabled();
  });

  it('shows empty state when no orders', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    expect(await screen.findByText(t('fillViaDegiroModal.noOrders'))).toBeInTheDocument();
  });
});
