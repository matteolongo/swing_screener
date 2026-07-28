import { createApiClient } from './client';
import type { ScreenerResult, TaxonomyFilter, SymbolPoolResponse, PoolPresetsResponse } from '@/types/api';

const api = createApiClient();

export function runScreener(filter: TaxonomyFilter): Promise<ScreenerResult> {
  return api.post<ScreenerResult>('/api/screener/run', { taxonomy_filter: filter });
}

export function getScreenerJob(jobId: string): Promise<ScreenerResult> {
  return api.get<ScreenerResult>(`/api/screener/run/${jobId}`);
}

export function getPoolPresets(): Promise<PoolPresetsResponse> {
  return api.get<PoolPresetsResponse>('/api/pool/presets');
}

export function getSymbolPool(params?: Record<string, string>): Promise<SymbolPoolResponse> {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return api.get<SymbolPoolResponse>(`/api/pool/symbols${query}`);
}

export function getReviewQueue(): Promise<{ entries: unknown[] }> {
  return api.get<{ entries: unknown[] }>('/api/pool/review-queue');
}

export function removeReviewQueueEntry(symbol: string): Promise<{ removed: boolean }> {
  return api.post<{ removed: boolean }>(`/api/pool/review-queue/${symbol}/remove`);
}

export function restoreReviewQueueEntry(symbol: string): Promise<{ restored: boolean }> {
  return api.post<{ restored: boolean }>(`/api/pool/review-queue/${symbol}/restore`);
}
