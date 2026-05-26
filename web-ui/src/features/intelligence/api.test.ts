import { describe, it, expect } from 'vitest';
import { candidateToPayload } from './api';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';

const baseCandidate: SymbolAnalysisCandidate = {
  ticker: 'AAPL',
  close: 150,
  signal: 'BUY',
};

describe('candidateToPayload', () => {
  it('returns null when candidate has no close price', () => {
    expect(candidateToPayload({ ticker: 'AAPL' })).toBeNull();
  });

  it('maps candidate fields to API payload', () => {
    const payload = candidateToPayload({
      ...baseCandidate,
      sma20: 145,
      sma50: 138,
      momentum6m: 12.5,
      sector: 'Technology',
      currency: 'USD',
      entry: 152,
      stop: 143,
    });
    expect(payload).not.toBeNull();
    expect(payload!.close).toBe(150);
    expect(payload!.signal).toBe('BUY');
    expect(payload!.sma_20).toBe(145);
    expect(payload!.sma_50).toBe(138);
    expect(payload!.momentum_6m).toBe(12.5);
    expect(payload!.sector).toBe('Technology');
    expect(payload!.entry).toBe(152);
    expect(payload!.stop).toBe(143);
  });

  it('omits position fields when no position provided', () => {
    const payload = candidateToPayload(baseCandidate);
    expect(payload!.entry_price).toBeUndefined();
    expect(payload!.r_now).toBeUndefined();
    expect(payload!.days_open).toBeUndefined();
  });

  it('omits position fields when null position provided', () => {
    const payload = candidateToPayload(baseCandidate, null);
    expect(payload!.entry_price).toBeUndefined();
    expect(payload!.r_now).toBeUndefined();
    expect(payload!.days_open).toBeUndefined();
  });

  it('includes position context when open position provided', () => {
    const position = {
      entryPrice: 140,
      rNow: 1.5,
      daysOpen: 12,
    } as PositionWithMetrics;
    const payload = candidateToPayload(baseCandidate, position);
    expect(payload!.entry_price).toBe(140);
    expect(payload!.r_now).toBe(1.5);
    expect(payload!.days_open).toBe(12);
  });

  it('position context does not overwrite candidate technical fields', () => {
    const position = {
      entryPrice: 140,
      rNow: 1.5,
      daysOpen: 12,
    } as PositionWithMetrics;
    const payload = candidateToPayload({ ...baseCandidate, entry: 152, stop: 143 }, position);
    expect(payload!.entry).toBe(152);
    expect(payload!.stop).toBe(143);
    expect(payload!.entry_price).toBe(140);
  });
});
