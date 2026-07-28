import { createApiClient } from './client';
import type { WatchlistItem } from '@/types/api';

const api = createApiClient();

export function getWatchlist(): Promise<WatchlistItem[]> {
  return api.get<WatchlistItem[]>('/api/watchlist');
}

export function addWatchlistItem(ticker: string): Promise<WatchlistItem> {
  return api.put<WatchlistItem>(`/api/watchlist/${ticker}`);
}

export function removeWatchlistItem(ticker: string): Promise<void> {
  return api.del<void>(`/api/watchlist/${ticker}`);
}
