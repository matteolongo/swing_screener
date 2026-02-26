import type { Position } from '@/features/portfolio/types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toDateSlug(value: string): string {
  const parts = value.trim().split('-');
  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    return parts.join('');
  }
  return 'UNKNOWN';
}

export function currentDateIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

export function orderTimestampId(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  return `${year}${month}${day}${hour}${minute}${second}`;
}

export function nextOrderId(
  ticker: string,
  existingOrderIds: Set<string>,
  now: Date = new Date(),
): string {
  const base = `${ticker.toUpperCase()}-${orderTimestampId(now)}`;
  if (!existingOrderIds.has(base)) {
    return base;
  }

  let suffix = 1;
  let candidate = `${base}-${suffix}`;
  while (existingOrderIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export function randomOrderId(prefix: string = 'ORD'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }
  const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${randomPart}`;
}

export function nextPositionId(
  ticker: string,
  entryDate: string,
  positions: Position[],
): string {
  const normalizedTicker = ticker.toUpperCase();
  const slug = toDateSlug(entryDate);
  const usedIds = new Set(
    positions
      .map((position) => position.positionId)
      .filter((value): value is string => Boolean(value)),
  );

  const existingForDay = positions.filter(
    (position) => position.positionId && position.ticker === normalizedTicker && position.entryDate === entryDate,
  );

  let sequence = existingForDay.length + 1;
  let candidate = `POS-${normalizedTicker}-${slug}-${String(sequence).padStart(2, '0')}`;
  while (usedIds.has(candidate)) {
    sequence += 1;
    candidate = `POS-${normalizedTicker}-${slug}-${String(sequence).padStart(2, '0')}`;
  }
  return candidate;
}
