import { test, expect } from '@playwright/test';

const ordersPayload = {
  asof: '2026-01-21',
  orders: [
    {
      order_id: 'AAA-1',
      ticker: 'AAA',
      status: 'pending',
      order_type: 'BUY_LIMIT',
      limit_price: 10,
      quantity: 1,
      stop_price: 9,
      order_date: '2026-01-01',
      filled_date: '',
      entry_price: null,
      notes: '',
      locked: false,
    },
  ],
};

const positionsPayload = {
  asof: '2026-01-21',
  positions: [
    {
      ticker: 'AAA',
      status: 'open',
      entry_date: '2026-01-01',
      entry_price: 10,
      stop_price: 9,
      shares: 1,
      notes: '',
      locked: false,
    },
  ],
};

const previewPayload = {
  diff: {
    orders: [{ order_id: 'AAA-1', changes: { status: ['pending', 'filled'] } }],
    positions: [],
  },
  warnings: [],
};

test('loads dashboard and previews changes', async ({ page }) => {
  await page.route('**/orders', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(ordersPayload),
    });
  });
  await page.route('**/positions', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(positionsPayload),
    });
  });
  await page.route('**/preview', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(previewPayload),
    });
  });
  await page.route('**/apply', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, asof: '2026-01-21' }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Swing Screener Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Positions' })).toBeVisible();

  await page.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(page.getByText('AAA-1')).toBeVisible();
});
