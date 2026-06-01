import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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

  it('shows Fill via DeGiro button when degiro is available', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [pendingOrder], asof: '2026-04-27' })
      ),
      http.get('*/api/portfolio/degiro/status', () =>
        HttpResponse.json({
          installed: true,
          credentials_configured: true,
          available: true,
          mode: 'ready',
          detail: '',
        })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(
      await screen.findByRole('button', { name: t('pendingOrdersTab.fillViaDegiro') })
    ).toBeInTheDocument();
    // button should be enabled when degiro is available
    expect(
      screen.getByRole('button', { name: t('pendingOrdersTab.fillViaDegiro') })
    ).not.toBeDisabled();
  });
});
