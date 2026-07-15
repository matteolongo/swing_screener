import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePosition, createOrder, fillOrder, partialClosePosition } from '@/features/portfolio/api';

describe('portfolio api', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'api');
    vi.unstubAllGlobals();
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
