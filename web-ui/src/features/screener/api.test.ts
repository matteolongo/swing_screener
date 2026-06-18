import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runScreener } from './api';

const launchResponse = {
  ok: true,
  status: 202,
  json: async () => ({ job_id: 'job-1', status: 'queued' }),
};

const statusResponse = (status: string, result: unknown = null, error: string | null = null) => ({
  ok: true,
  status: 200,
  json: async () => ({ job_id: 'job-1', status, result, error }),
  text: async () => JSON.stringify({ job_id: 'job-1', status, result, error }),
});

const emptyResult = {
  candidates: [],
  asof_date: '2026-06-09',
  total_screened: 0,
  data_freshness: 'final_close',
  warnings: [],
};

describe('runScreener async polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps polling past two minutes for long backend runs', async () => {
    const start = Date.now();
    const fourMinutes = 4 * 60 * 1000;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/run')) return launchResponse;
      return Date.now() - start >= fourMinutes
        ? statusResponse('completed', emptyResult)
        : statusResponse('running');
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = runScreener({ universe: 'broad_market_stocks', top: 5 });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await resultPromise;

    expect(result.asofDate).toBe('2026-06-09');
    expect(result.candidates).toEqual([]);
  });

  it('rejects once the overall polling budget is exhausted', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/run')) return launchResponse;
      return statusResponse('running');
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = runScreener({ universe: 'broad_market_stocks', top: 5 });
    const expectation = expect(resultPromise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
    await expectation;
  });

  it('surfaces backend job errors', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/run')) return launchResponse;
      return statusResponse('error', null, 'boom');
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = runScreener({ universe: 'broad_market_stocks', top: 5 });
    const expectation = expect(resultPromise).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(1000);
    await expectation;
  });
});
