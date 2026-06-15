import {
  getAvailablePriceRanges,
  getDefaultPriceRange,
  slicePriceHistory,
} from './priceHistory';
import { describe, expect, it } from 'vitest';

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const mkHistory = (startDate: string, len: number) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: len }, (_, idx) => {
    const pointDate = new Date(start.getTime());
    pointDate.setUTCDate(start.getUTCDate() + idx);
    return {
      date: toIsoDate(pointDate),
      close: idx + 1,
    };
  });
};

describe('priceHistory helpers', () => {
  it('returns 1W and MAX when between a week and a month of bars', () => {
    expect(getAvailablePriceRanges(mkHistory('2026-02-01', 10))).toEqual(['1W', 'MAX']);
  });

  it('returns ranges based on calendar span and includes MAX when extra older data exists', () => {
    expect(getAvailablePriceRanges(mkHistory('2025-02-01', 500))).toEqual(['1W', '1M', '3M', '6M', '1Y', 'MAX']);
  });

  it('keeps exact range set without MAX when the history starts exactly at the boundary', () => {
    expect(getAvailablePriceRanges(mkHistory('2025-02-17', 366))).toEqual(['1W', '1M', '3M', '6M', '1Y']);
  });

  it('slices history to the last week for the 1W range', () => {
    const history = mkHistory('2025-08-01', 60);
    const sliced = slicePriceHistory(history, '1W');
    expect(sliced.length).toBeGreaterThanOrEqual(7);
    expect(sliced.length).toBeLessThanOrEqual(8);
    expect(sliced[sliced.length - 1]).toEqual(history[history.length - 1]);
  });

  it('slices history for selected range', () => {
    const history = mkHistory('2025-08-01', 220);
    const sliced = slicePriceHistory(history, '3M');

    expect(sliced.length).toBeGreaterThan(60);
    expect(sliced.length).toBeLessThan(100);
    expect(sliced[0].close).toBeGreaterThan(1);
    expect(sliced[sliced.length - 1].close).toBe(220);
  });

  it('prefers 3M as default when available', () => {
    expect(getDefaultPriceRange(['1M', '3M', '6M'])).toBe('3M');
  });

  it('falls back to the largest available range when 3M is missing', () => {
    expect(getDefaultPriceRange(['MAX'])).toBe('MAX');
    expect(getDefaultPriceRange(['1M', '6M'])).toBe('6M');
  });
});
