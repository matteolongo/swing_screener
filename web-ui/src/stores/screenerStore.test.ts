import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScreenerStore } from './screenerStore';
import type { ScreenerResponse } from '@/features/screener/types';

function candidate(ticker: string, rank: number, action?: string, conviction?: string) {
  return {
    ticker,
    rank,
    confidence: 50,
    decisionSummary: action ? { action, conviction } : undefined,
  };
}

function response(candidates: ReturnType<typeof candidate>[]): ScreenerResponse {
  return { candidates } as unknown as ScreenerResponse;
}

describe('useScreenerStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useScreenerStore.setState({
      lastResult: null,
      lastRunContext: null,
      todayRun: null,
      todayRunInitialized: false,
    });
  });

  it('prioritizes candidates by decision action on setLastResult', () => {
    const { result } = renderHook(() => useScreenerStore());

    act(() =>
      result.current.setLastResult(
        response([candidate('LOW', 1, 'WATCH', 'low'), candidate('TOP', 2, 'BUY_NOW', 'high')])
      )
    );

    expect(result.current.lastResult?.candidates[0].ticker).toBe('TOP');
  });

  it('clears the stored result', () => {
    const { result } = renderHook(() => useScreenerStore());

    act(() => result.current.setLastResult(response([candidate('AAA', 1)])));
    act(() => result.current.clearLastResult());

    expect(result.current.lastResult).toBeNull();
  });

  it('patchCandidate updates only the matching ticker (case-insensitive)', () => {
    const { result } = renderHook(() => useScreenerStore());

    act(() => result.current.setLastResult(response([candidate('AAA', 1), candidate('BBB', 2)])));
    act(() =>
      result.current.patchCandidate('aaa', (c) => ({ ...c, confidence: 99 }))
    );

    const patched = result.current.lastResult?.candidates.find((c) => c.ticker === 'AAA');
    const untouched = result.current.lastResult?.candidates.find((c) => c.ticker === 'BBB');
    expect(patched?.confidence).toBe(99);
    expect(untouched?.confidence).toBe(50);
  });

  it('patchCandidate is a no-op when there is no result', () => {
    const { result } = renderHook(() => useScreenerStore());

    act(() => result.current.patchCandidate('AAA', (c) => c));

    expect(result.current.lastResult).toBeNull();
  });

  it('keeps full price history in memory and does not use localStorage', () => {
    const { result } = renderHook(() => useScreenerStore());
    const withHistory = {
      ...candidate('AAA', 1),
      priceHistory: [{ date: '2024-01-01', open: 9, high: 11, low: 8, close: 10, volume: 100 }],
      benchmarkPriceHistory: [{ date: '2024-01-01', close: 100 }],
    };

    act(() => result.current.setLastResult(response([withHistory])));

    // in-memory state keeps the full OHLCV history so charts render this session
    const liveCandidate = result.current.lastResult?.candidates[0] as unknown as Record<string, unknown>;
    expect(liveCandidate.priceHistory).toBeDefined();
    expect((liveCandidate.priceHistory as Array<{ open: number }>)[0].open).toBe(9);

    // persistence moved to IndexedDB; nothing is written to localStorage anymore
    expect(localStorage.getItem('swing-screener-last-result')).toBeNull();
  });

  it('keeps Today pinned to its selected run when a later scan is exploration-only', () => {
    const { result } = renderHook(() => useScreenerStore());
    const todayResult = response([candidate('TODAY', 1)]);
    const explorationResult = response([candidate('EXPLORE', 1)]);

    act(() => result.current.recordScreenerRun(
      todayResult,
      {
        request: { preset: 'us_large_cap_equities', minPrice: 0, maxPrice: 500 },
        displayFilters: { recommendedOnly: true, actionFilter: 'all' },
        completedAt: '2026-07-10T20:00:00Z',
      },
      true,
    ));
    act(() => result.current.recordScreenerRun(
      explorationResult,
      {
        request: { preset: 'europe_large_cap_equities' },
        displayFilters: { recommendedOnly: false, actionFilter: 'all' },
        completedAt: '2026-07-11T08:00:00Z',
      },
      false,
    ));

    expect(result.current.lastResult?.candidates[0].ticker).toBe('EXPLORE');
    expect(result.current.todayRun?.result.candidates[0].ticker).toBe('TODAY');
    expect(result.current.todayRun?.displayFilters.recommendedOnly).toBe(true);
  });
});
