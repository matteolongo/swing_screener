import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runEventStudy } from './api';
import type { EventStudyResponseAPI } from './types';

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

const emptyResult: EventStudyResponseAPI = {
  tickers: ['TEST'],
  start: '2022-01-01',
  end: '2022-02-01',
  config_used: {},
  trades: [],
  metrics: {
    n_trades: 0,
    win_rate: 0,
    expectancy_r: 0,
    total_r: 0,
    profit_factor: null,
    avg_win_r: 0,
    avg_loss_r: 0,
    avg_bars_held: 0,
    max_drawdown_r: 0,
    exit_reason_counts: {},
    by_setup: {},
  },
};

describe('runEventStudy async polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polls until the job completes and returns the transformed result', async () => {
    const start = Date.now();
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/event-study')) return launchResponse;
      return Date.now() - start >= 3000
        ? statusResponse('completed', emptyResult)
        : statusResponse('running');
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = runEventStudy({ tickers: ['TEST'] });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;

    expect(result.tickers).toEqual(['TEST']);
    expect(result.trades).toEqual([]);
  });

  it('surfaces backend job errors', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/event-study')) return launchResponse;
      return statusResponse('error', null, 'boom');
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = runEventStudy({ tickers: ['TEST'] });
    const expectation = expect(resultPromise).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(1000);
    await expectation;
  });

  it('returns directly when the backend responds 200 (sync mode)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => emptyResult,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runEventStudy({ tickers: ['TEST'] });

    expect(result.tickers).toEqual(['TEST']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serializes camelCase config overrides to snake_case', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => emptyResult,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await runEventStudy({
      tickers: ['TEST'],
      start: '2023-01-01',
      config: { patternStopEnabled: false, breakevenAtR: 0.5, kAtr: 2.5 },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.tickers).toEqual(['TEST']);
    expect(body.start).toBe('2023-01-01');
    expect(body.config).toEqual({
      pattern_stop_enabled: false,
      breakeven_at_r: 0.5,
      k_atr: 2.5,
    });
  });
});
