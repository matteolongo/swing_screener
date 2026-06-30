import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
  ReviewQueueEntry,
  TaxonomyPreset,
  transformPreset,
  transformReviewEntry,
} from './types';

export async function fetchPresets(): Promise<TaxonomyPreset[]> {
  const body = await fetchJson<{ presets?: unknown[] }>(API_ENDPOINTS.poolPresets, {
    errorMessage: 'Failed to load taxonomy presets',
  });
  return (body.presets ?? []).map((p) => transformPreset(p as Parameters<typeof transformPreset>[0]));
}

export async function fetchReviewQueue(): Promise<ReviewQueueEntry[]> {
  const body = await fetchJson<{ entries?: unknown[] }>(API_ENDPOINTS.poolReviewQueue, {
    errorMessage: 'Failed to load review queue',
  });
  return (body.entries ?? []).map((e) => transformReviewEntry(e as Parameters<typeof transformReviewEntry>[0]));
}

export async function removeFromPool(symbol: string): Promise<boolean> {
  const body = await fetchJson<{ removed: boolean }>(API_ENDPOINTS.poolReviewQueueRemove(symbol), {
    method: 'POST',
    errorMessage: 'Failed to remove symbol from pool',
  });
  return body.removed;
}

export async function restoreToPool(symbol: string): Promise<boolean> {
  const body = await fetchJson<{ restored: boolean }>(API_ENDPOINTS.poolReviewQueueRestore(symbol), {
    method: 'POST',
    errorMessage: 'Failed to restore symbol to pool',
  });
  return body.restored;
}
