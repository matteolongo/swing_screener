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
    useScreenerStore.setState({ lastResult: null });
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

  it('keeps price history in memory but strips it from the persisted copy', () => {
    const { result } = renderHook(() => useScreenerStore());
    const withHistory = {
      ...candidate('AAA', 1),
      priceHistory: [{ date: '2024-01-01', close: 10 }],
      benchmarkPriceHistory: [{ date: '2024-01-01', close: 100 }],
    };

    act(() => result.current.setLastResult(response([withHistory])));

    // in-memory state keeps the heavy arrays so charts render this session
    const liveCandidate = result.current.lastResult?.candidates[0] as unknown as Record<string, unknown>;
    expect(liveCandidate.priceHistory).toBeDefined();

    // persisted copy drops them to stay under the localStorage quota
    const persisted = JSON.parse(localStorage.getItem('swing-screener-last-result') as string);
    const persistedCandidate = persisted.state.lastResult.candidates[0];
    expect(persistedCandidate.ticker).toBe('AAA');
    expect(persistedCandidate.priceHistory).toBeUndefined();
    expect(persistedCandidate.benchmarkPriceHistory).toBeUndefined();
  });
});
