import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePosition, createOrder, fetchOrders, fetchPositions, fillOrder, partialClosePosition, updatePositionStop, updatePositionTrailMethod } from '@/features/portfolio/api';
import { t } from '@/i18n/t';

describe('portfolio api', () => {
  it('rejects a trail response without a committed version instead of allowing an unguarded followup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await expect(updatePositionTrailMethod('POS-1', { trailMethod: 'manual', expectedVersion: 1 }))
      .rejects.toThrow(t('positions.concurrency.versionUnavailable'));
  });
  it.each([
    () => closePosition('POS-1', { exitPrice: 110, expectedVersion: 42 }),
    () => partialClosePosition('POS-1', { sharesClosed: 2, price: 110, expectedVersion: 42 }),
    () => updatePositionStop('POS-1', { newStop: 97, expectedVersion: 42 }),
    () => updatePositionTrailMethod('POS-1', { trailMethod: 'manual', expectedVersion: 42 }),
  ])('carries the reviewed position version in management requests %#', async (execute) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"position_version":43}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await execute();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).expected_version).toBe(42);
  });

  it('preserves a position version through the API boundary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      positions: [{ ticker: 'AAPL', position_id: 'POS-1', status: 'open', entry_date: '2026-10-01',
        entry_price: 100, stop_price: 95, shares: 5, version: 7 }],
    }), { status: 200 })));
    expect((await fetchPositions('open'))[0].version).toBe(7);
  });
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('transforms server-owned snapshot freshness at the API boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        orders: [],
        asof: '2026-07-20',
        snapshot_freshness: 'stale',
        stale_after_days: 1,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal(
      'fetch',
      fetchMock,
    );

    const orders = await fetchOrders('all');

    expect(orders.snapshotAsOf).toBe('2026-07-20');
    expect(orders.snapshotFreshness).toBe('stale');
    expect(orders.snapshotStaleAfterDays).toBe(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('status=all');
  });

  it('sends a concrete order status to the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ orders: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchOrders('pending');

    expect(String(fetchMock.mock.calls[0][0])).toContain('status=pending');
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
