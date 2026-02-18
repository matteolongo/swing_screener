import type { PriceHistoryPoint } from './types';

export type PriceRangeKey = '1M' | '3M' | '6M' | '1Y' | 'MAX';

interface PriceRangeSpec {
  key: Exclude<PriceRangeKey, 'MAX'>;
  months: number;
}

const RANGE_SPECS: PriceRangeSpec[] = [
  { key: '1M', months: 1 },
  { key: '3M', months: 3 },
  { key: '6M', months: 6 },
  { key: '1Y', months: 12 },
];

function parsePointDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shiftMonths(date: Date, months: number): Date {
  const shifted = new Date(date.getTime());
  shifted.setUTCMonth(shifted.getUTCMonth() - months);
  return shifted;
}

function getHistoryBounds(history: PriceHistoryPoint[]): { first: Date; last: Date } | null {
  if (history.length === 0) {
    return null;
  }
  const first = parsePointDate(history[0].date);
  const last = parsePointDate(history[history.length - 1].date);
  if (!first || !last) {
    return null;
  }
  return { first, last };
}

export function getAvailablePriceRanges(history: PriceHistoryPoint[]): PriceRangeKey[] {
  const bounds = getHistoryBounds(history);
  if (!bounds) {
    return [];
  }

  const available = RANGE_SPECS
    .filter((range) => bounds.first <= shiftMonths(bounds.last, range.months))
    .map((range) => range.key);

  if (available.length === 0) {
    return ['MAX'];
  }

  const largestMonths = RANGE_SPECS.find((range) => range.key === available[available.length - 1])?.months ?? 0;
  if (bounds.first < shiftMonths(bounds.last, largestMonths)) {
    return [...available, 'MAX'];
  }

  return available;
}

export function slicePriceHistory(
  history: PriceHistoryPoint[],
  range: PriceRangeKey,
): PriceHistoryPoint[] {
  const bounds = getHistoryBounds(history);
  if (!bounds) {
    return history;
  }

  if (history.length === 0 || range === 'MAX') {
    return history;
  }

  const months = RANGE_SPECS.find((item) => item.key === range)?.months;
  if (!months) {
    return history;
  }

  const cutoff = shiftMonths(bounds.last, months);
  const sliced = history.filter((point) => {
    const date = parsePointDate(point.date);
    return date != null && date >= cutoff;
  });

  return sliced.length > 0 ? sliced : history;
}

export function getDefaultPriceRange(availableRanges: PriceRangeKey[]): PriceRangeKey {
  if (availableRanges.includes('3M')) {
    return '3M';
  }
  return availableRanges[availableRanges.length - 1] ?? 'MAX';
}
