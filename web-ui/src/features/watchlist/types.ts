import type { PriceHistoryPoint } from '@/features/screener/types';

export interface WatchItemAPI {
  ticker: string;
  watched_at: string;
  watch_price?: number | null;
  currency?: string | null;
  source: string;
  current_price?: number | null;
  last_bar?: string | null;
  signal?: string | null;
  signal_trigger_price?: number | null;
  distance_to_trigger_pct?: number | null;
  price_history?: PriceHistoryPoint[] | null;
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
  currentPrice?: number;
  lastBar?: string;
  signal?: string;
  signalTriggerPrice?: number;
  distanceToTriggerPct?: number;
  priceHistory: PriceHistoryPoint[];
}

export interface WatchSymbolRequest {
  ticker: string;
  watchPrice?: number | null;
  currency?: string | null;
  source: string;
}

export interface WatchlistPipelineItemAPI {
  ticker: string;
  current_price: number | null;
  watch_price: number | null;
  signal: string | null;
  trigger_price: number | null;
  trigger_type: string | null;
  distance_pct: number | null;
  sparkline: number[];
}

export interface WatchlistPipelineResponseAPI {
  items: WatchlistPipelineItemAPI[];
}

export interface WatchlistPipelineItem {
  ticker: string;
  currentPrice: number | null;
  watchPrice: number | null;
  signal: string | null;
  triggerPrice: number | null;
  triggerType: string | null;
  distancePct: number | null;
  sparkline: number[];
}

export function transformWatchlistPipelineItem(api: WatchlistPipelineItemAPI): WatchlistPipelineItem {
  return {
    ticker: api.ticker,
    currentPrice: api.current_price,
    watchPrice: api.watch_price,
    signal: api.signal,
    triggerPrice: api.trigger_price,
    triggerType: api.trigger_type,
    distancePct: api.distance_pct,
    sparkline: api.sparkline,
  };
}

export function transformWatchItem(api: WatchItemAPI): WatchItem {
  return {
    ticker: api.ticker.trim().toUpperCase(),
    watchedAt: api.watched_at,
    watchPrice: api.watch_price ?? undefined,
    currency: api.currency?.trim().toUpperCase() || undefined,
    source: api.source,
    currentPrice: api.current_price ?? undefined,
    lastBar: api.last_bar ?? undefined,
    signal: api.signal ?? undefined,
    signalTriggerPrice: api.signal_trigger_price ?? undefined,
    distanceToTriggerPct: api.distance_to_trigger_pct ?? undefined,
    priceHistory: api.price_history ?? [],
  };
}
