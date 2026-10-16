import { describe, expect, it } from 'vitest';
import { getResultMarketStatus, getResultCandleDates, summarizeResultQuality } from './resultQuality';
import type { ScreenerResponse } from './types';

describe('scan result quality presentation', () => {
  it('preserves a partial provider warning without treating excluded candidates as failures', () => {
    expect(summarizeResultQuality({ requested: 4, evaluated: 3,
      warnings: ['TEST_PROVIDER_UNAVAILABLE'], marketStatus: 'final_close' })).toEqual({
      coverage: 'partial', marketStatus: 'final_close', warnings: ['TEST_PROVIDER_UNAVAILABLE'],
    });
  });
  it.each([
    [4, 4, 'complete'], [4, 0, 'empty'], [0, 0, 'empty'],
  ] as const)('maps %i requested / %i evaluated to %s coverage', (requested, evaluated, coverage) => {
    expect(summarizeResultQuality({ requested, evaluated, warnings: [], marketStatus: 'unknown' }).coverage).toBe(coverage);
  });
  const result = (changes: Partial<ScreenerResponse> = {}): ScreenerResponse => ({
    asofDate: '2026-10-14', totalScreened: 4, totalWithMarketData: 3, dataFreshness: 'final_close',
    candidates: [{ ticker: 'TEST', lastBar: '2026-10-14', dataAsOf: '2026-10-14', dataStatus: 'current' }] as ScreenerResponse['candidates'],
    ...changes,
  });
  it('keeps a fresh request with old candles stale', () => {
    const stale = result({ candidates: [{ ticker: 'TEST', lastBar: '2026-10-02', dataStatus: 'stale' }] as ScreenerResponse['candidates'] });
    expect(getResultMarketStatus(stale)).toBe('stale');
    expect(getResultCandleDates(stale)).toEqual(['2026-10-02']);
    expect(getResultMarketStatus(result())).toBe('final_close');
    expect(getResultMarketStatus(result({ dataFreshness: 'intraday' }))).toBe('intraday');
  });
  it('never invents a candle date or final status from a requested date', () => {
    expect(getResultMarketStatus(result({ candidates: [] }))).toBe('unknown');
    expect(getResultCandleDates(result({ candidates: [] }))).toEqual([]);
    expect(getResultMarketStatus(result({ candidates: [{ lastBar: 'not-a-date' }] as ScreenerResponse['candidates'] }))).toBe('unknown');
  });
  it('keeps a persisted dated candidate with no status unknown', () => {
    const legacy = result({ candidates: [{ ticker: 'TEST', lastBar: '2026-10-14' }] as ScreenerResponse['candidates'] });
    expect(getResultMarketStatus(legacy)).toBe('unknown');
  });
});
