import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePosition, createOrder, fetchOrders, fetchPositions, fetchPositionMetrics, fetchPortfolioSummary, fillOrder, partialClosePosition } from '@/features/portfolio/api';
import { resetTradingStore, mutateTradingStore, readTradingStore } from '@/features/persistence';

describe('portfolio api', () => {
  it('uses the stateless projection for local metrics without recalculating or saving it', async () => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'true');
    resetTradingStore();
    mutateTradingStore(store => { store.positions = [{ ticker: 'AAPL', status: 'open', positionId: 'POS-1', entryDate: '2026-09-08', entryPrice: 100, stopPrice: 95, shares: 10 }]; });
    const before = readTradingStore();
    const position = { ticker: 'AAPL', status: 'open', position_id: 'POS-1', entry_date: '2026-09-08', entry_price: 100, stop_price: 95, shares: 10, current_price: 110, pnl: 91.23, pnl_percent: 9.123, r_now: 1.8246, r_fx_adjusted: 1.77, entry_value: 1000, current_value: 1100, per_share_risk: 5, total_risk: 50, fees_eur: 7.8 };
    const summary = { total_positions: 1, total_value: 989.43, total_cost_basis: 899.12, total_pnl: 81.02, total_pnl_percent: 9.01, open_risk: 44.96, open_risk_percent: 0.44, account_size: 10000, available_capital: 9011.12, largest_position_value: 989.43, largest_position_ticker: 'AAPL', best_performer_ticker: 'AAPL', best_performer_pnl_pct: 9.123, worst_performer_ticker: 'AAPL', worst_performer_pnl_pct: 9.123, avg_r_now: 1.8246, positions_profitable: 1, positions_losing: 0, win_rate: 100, concentration: [], realized_pnl: 0.55, effective_account_size: 10000.55 };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ positions: [position], summary }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchPositions('open'))[0]).toMatchObject({ pnl: 91.23, rNow: 1.8246, feesEur: 7.8 });
    expect(await fetchPositionMetrics('POS-1')).toMatchObject({ rNow: 1.8246, rFxAdjusted: 1.77 });
    expect(await fetchPortfolioSummary()).toMatchObject({ totalValue: 989.43, availableCapital: 9011.12 });
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/api/portfolio/state/metrics'))).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ revision: 0, positions: [{ position_id: 'POS-1' }] });
    expect(readTradingStore()).toEqual(before);
  });
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'api');
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
