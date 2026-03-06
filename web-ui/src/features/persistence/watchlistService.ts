import { mutateTradingStore, readTradingStore } from '@/features/persistence/storage';
import type { PersistedWatchItem } from '@/features/persistence/schema';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCurrency(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function normalizeSource(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error('source is required');
  }
  return normalized;
}

export interface LocalWatchUpsertRequest {
  ticker: string;
  watchPrice?: number | null;
  currency?: string | null;
  source: string;
}

export function listWatchlistLocal(): PersistedWatchItem[] {
  return cloneValue(readTradingStore().watchlist);
}

export function watchSymbolLocal(request: LocalWatchUpsertRequest): PersistedWatchItem {
  const ticker = normalizeTicker(request.ticker);
  if (!ticker) {
    throw new Error('ticker is required');
  }
  const source = normalizeSource(request.source);

  let createdOrExisting: PersistedWatchItem | null = null;
  mutateTradingStore((store) => {
    const existing = store.watchlist.find((item) => item.ticker === ticker);
    if (existing) {
      createdOrExisting = existing;
      return;
    }

    const created: PersistedWatchItem = {
      ticker,
      watchedAt: new Date().toISOString(),
      watchPrice: request.watchPrice ?? null,
      currency: normalizeCurrency(request.currency),
      source,
    };
    store.watchlist.push(created);
    createdOrExisting = created;
  });

  if (!createdOrExisting) {
    throw new Error(`Failed to create watch for ticker: ${ticker}`);
  }
  return cloneValue(createdOrExisting);
}

export function unwatchSymbolLocal(ticker: string): boolean {
  const normalizedTicker = normalizeTicker(ticker);
  let deleted = false;
  mutateTradingStore((store) => {
    const initialLength = store.watchlist.length;
    store.watchlist = store.watchlist.filter((item) => item.ticker !== normalizedTicker);
    deleted = store.watchlist.length < initialLength;
  });
  return deleted;
}

