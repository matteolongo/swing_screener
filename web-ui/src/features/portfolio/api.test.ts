import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePosition, createOrder, fetchOrders, fillOrder, partialClosePosition } from '@/features/portfolio/api';

describe('portfolio api', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'api');
    vi.unstubAllGlobals();
  });

  it('transforms server-owned snapshot freshness at the API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          orders: [],
          asof: '2026-07-20',
          snapshot_freshness: 'stale',
          stale_after_days: 1,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const orders = await fetchOrders('all');

    expect(orders.snapshotAsOf).toBe('2026-07-20');
    expect(orders.snapshotFreshness).toBe('stale');
    expect(orders.snapshotStaleAfterDays).toBe(1);
  });

  it('marks an older additive response with omitted metadata as unknown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ orders: [], asof: '2026-07-20' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const orders = await fetchOrders('all');

    expect(orders.snapshotFreshness).toBe('unknown');
  });

  it('keeps local persistence freshness unknown without synthesizing a client policy', async () => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');

    const orders = await fetchOrders('all');

    expect(orders.snapshotFreshness).toBe('unknown');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('surfaces backend detail when fill order fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'REP.MC: open position already exists.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      fillOrder('ORD-REP-1', {
        filledPrice: 21.8,
        filledDate: '2026-03-11',
        stopPrice: 20.33,
      }),
    ).rejects.toThrow('REP.MC: open position already exists.');
  });

  it('rejects an API entry order without an approval token before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createOrder({
        ticker: 'AAPL',
        orderType: 'BUY_LIMIT',
        quantity: 2,
        limitPrice: 100,
        stopPrice: 95,
        targetPrice: 110,
      }),
    ).rejects.toThrow('approval token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a fresh idempotency key for distinct create submissions', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(null, { status: 201 })));
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    vi.stubGlobal('crypto', { randomUUID });
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      ticker: 'AAPL',
      orderType: 'BUY_LIMIT' as const,
      quantity: 2,
      limitPrice: 100,
      stopPrice: 95,
      targetPrice: 110,
      approvalToken: 'approval-token',
    };

    await createOrder(request);
    await createOrder(request);

    expect(randomUUID).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Idempotency-Key')).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('reuses a caller-supplied idempotency key for an order retry', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      ticker: 'AAPL',
      orderType: 'BUY_LIMIT' as const,
      quantity: 2,
      limitPrice: 100,
      stopPrice: 95,
      targetPrice: 110,
      approvalToken: 'approval-token',
    };

    await createOrder(request, 'create-aapl-retry');
    await createOrder(request, 'create-aapl-retry');

    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key')).toBe(
      'create-aapl-retry',
    );
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Idempotency-Key')).toBe(
      'create-aapl-retry',
    );
  });

  it('sends one idempotency key for a fill submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    const randomUUID = vi.fn().mockReturnValue('33333333-3333-4333-8333-333333333333');
    vi.stubGlobal('crypto', { randomUUID });
    vi.stubGlobal('fetch', fetchMock);

    await fillOrder('ORD-AAPL-1', {
      filledPrice: 100,
      filledDate: '2026-07-15',
      fillFxRate: 1.1,
    });

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key')).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('serializes close FX rate for backend close requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await closePosition('POS-AAPL-1', {
      exitPrice: 125,
      feeEur: 1.5,
      exitFxRate: 1.08,
      reason: 'target',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.exit_fx_rate).toBe(1.08);
  });

  it('serializes partial close FX rate for backend partial-close requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await partialClosePosition('POS-AAPL-1', {
      sharesClosed: 3,
      price: 121,
      feeEur: 0.9,
      fxRate: 1.07,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.fx_rate).toBe(1.07);
  });
});
