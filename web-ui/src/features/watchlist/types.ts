export interface WatchItemAPI {
  ticker: string;
  watched_at: string;
  watch_price?: number | null;
  currency?: string | null;
  source: string;
}

export interface WatchlistResponseAPI {
  items: WatchItemAPI[];
}

export interface WatchItem {
  ticker: string;
  watchedAt: string;
  watchPrice?: number;
  currency?: string;
  source: string;
}

export interface WatchSymbolRequest {
  ticker: string;
  watchPrice?: number | null;
  currency?: string | null;
  source: string;
}

export function transformWatchItem(api: WatchItemAPI): WatchItem {
  return {
    ticker: api.ticker.trim().toUpperCase(),
    watchedAt: api.watched_at,
    watchPrice: api.watch_price ?? undefined,
    currency: api.currency?.trim().toUpperCase() || undefined,
    source: api.source,
  };
}

