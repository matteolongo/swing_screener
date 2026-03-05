export type EntryOrderType = 'BUY_LIMIT' | 'BUY_STOP' | 'BUY_MARKET';
export type SuggestedOrderType = 'BUY_LIMIT' | 'BUY_STOP' | 'SKIP' | 'UNKNOWN';

export function normalizeSuggestedOrderType(value?: string | null): SuggestedOrderType {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'BUY_LIMIT') return 'BUY_LIMIT';
  if (normalized === 'BUY_STOP') return 'BUY_STOP';
  if (normalized === 'SKIP') return 'SKIP';
  return 'UNKNOWN';
}

export function fallbackOrderTypeForSignal(signal?: string | null): EntryOrderType {
  const normalized = String(signal ?? '').trim().toLowerCase();
  if (normalized === 'breakout') return 'BUY_STOP';
  if (normalized === 'pullback') return 'BUY_LIMIT';
  return 'BUY_LIMIT';
}

export function resolveDefaultOrderType(signal?: string | null, suggestedOrderType?: string | null): EntryOrderType {
  const normalized = normalizeSuggestedOrderType(suggestedOrderType);
  if (normalized === 'BUY_LIMIT' || normalized === 'BUY_STOP') {
    return normalized;
  }
  return fallbackOrderTypeForSignal(signal);
}

