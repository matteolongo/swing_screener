import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  isLocalPersistenceMode,
  listWatchlistLocal,
  unwatchSymbolLocal,
  watchSymbolLocal,
} from '@/features/persistence';
import type {
  WatchItem,
  WatchItemAPI,
  WatchlistResponseAPI,
  WatchSymbolRequest,
} from '@/features/watchlist/types';
import { transformWatchItem } from '@/features/watchlist/types';

export async function fetchWatchlist(): Promise<WatchItem[]> {
  if (isLocalPersistenceMode()) {
    return listWatchlistLocal().map((item) => ({
      ticker: item.ticker,
      watchedAt: item.watchedAt,
      watchPrice: item.watchPrice ?? undefined,
      currency: item.currency ?? undefined,
      source: item.source,
      priceHistory: [],
    }));
  }

  const response = await fetch(apiUrl(API_ENDPOINTS.watchlist));
  if (!response.ok) {
    throw new Error('Failed to fetch watchlist');
  }
  const data = (await response.json()) as WatchlistResponseAPI;
  return (data.items ?? []).map(transformWatchItem);
}

export async function watchSymbol(request: WatchSymbolRequest): Promise<WatchItem> {
  const ticker = request.ticker.trim().toUpperCase();
  if (!ticker) {
    throw new Error('ticker is required');
  }

  if (isLocalPersistenceMode()) {
    const saved = watchSymbolLocal({
      ticker,
      watchPrice: request.watchPrice ?? null,
      currency: request.currency ?? null,
      source: request.source,
    });
    return {
      ticker: saved.ticker,
      watchedAt: saved.watchedAt,
      watchPrice: saved.watchPrice ?? undefined,
      currency: saved.currency ?? undefined,
      source: saved.source,
      priceHistory: [],
    };
  }

  const response = await fetch(apiUrl(API_ENDPOINTS.watchlistItem(encodeURIComponent(ticker))), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      watch_price: request.watchPrice ?? null,
      currency: request.currency ?? null,
      source: request.source,
    }),
  });
  if (!response.ok) {
    let message = 'Failed to watch symbol';
    try {
      const error = await response.json();
      if (typeof error?.detail === 'string') {
        message = error.detail;
      }
    } catch {
      // Ignore JSON parse errors and use fallback.
    }
    throw new Error(message);
  }
  const data = (await response.json()) as WatchItemAPI;
  return transformWatchItem(data);
}

export async function unwatchSymbol(ticker: string): Promise<void> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    throw new Error('ticker is required');
  }

  if (isLocalPersistenceMode()) {
    const deleted = unwatchSymbolLocal(normalizedTicker);
    if (!deleted) {
      throw new Error(`Watch item not found: ${normalizedTicker}`);
    }
    return;
  }

  const response = await fetch(apiUrl(API_ENDPOINTS.watchlistItem(encodeURIComponent(normalizedTicker))), {
    method: 'DELETE',
  });
  if (!response.ok) {
    let message = 'Failed to unwatch symbol';
    try {
      const error = await response.json();
      if (typeof error?.detail === 'string') {
        message = error.detail;
      }
    } catch {
      // Ignore JSON parse errors and use fallback.
    }
    throw new Error(message);
  }
}
