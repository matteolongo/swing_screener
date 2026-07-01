import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import type {
  WatchItem,
  WatchItemAPI,
  WatchlistResponseAPI,
  WatchSymbolRequest,
} from '@/features/watchlist/types';
import { transformWatchItem } from '@/features/watchlist/types';

export async function fetchWatchlist(): Promise<WatchItem[]> {
  const data = await fetchJson<WatchlistResponseAPI>(API_ENDPOINTS.watchlist, {
    errorMessage: 'Failed to fetch watchlist',
  });
  return (data.items ?? []).map(transformWatchItem);
}

export async function watchSymbol(request: WatchSymbolRequest): Promise<WatchItem> {
  const ticker = request.ticker.trim().toUpperCase();
  if (!ticker) {
    throw new Error('ticker is required');
  }

  const data = await fetchJson<WatchItemAPI>(
    API_ENDPOINTS.watchlistItem(encodeURIComponent(ticker)),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_price: request.watchPrice ?? null,
        currency: request.currency ?? null,
        source: request.source,
      }),
      errorMessage: 'Failed to watch symbol',
    },
  );
  return transformWatchItem(data);
}

export async function unwatchSymbol(ticker: string): Promise<void> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    throw new Error('ticker is required');
  }

  await fetchJson<void>(API_ENDPOINTS.watchlistItem(encodeURIComponent(normalizedTicker)), {
    method: 'DELETE',
    errorMessage: 'Failed to unwatch symbol',
  });
}
