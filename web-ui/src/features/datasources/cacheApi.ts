import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';

export interface CacheStatusEntry {
  id: string;
  label: string;
  storage: 'disk_json' | 'disk_parquet' | 'memory';
  ttlDescription: string;
  canClear: boolean;
  lastModifiedAt: string | null;
  entryCount: number | null;
}

interface CacheStatusEntryAPI {
  id: string;
  label: string;
  storage: 'disk_json' | 'disk_parquet' | 'memory';
  ttl_description: string;
  can_clear: boolean;
  last_modified_at: string | null;
  entry_count: number | null;
}

function transformEntry(raw: CacheStatusEntryAPI): CacheStatusEntry {
  return {
    id: raw.id,
    label: raw.label,
    storage: raw.storage,
    ttlDescription: raw.ttl_description,
    canClear: raw.can_clear,
    lastModifiedAt: raw.last_modified_at,
    entryCount: raw.entry_count,
  };
}

export async function fetchCacheStatus(): Promise<CacheStatusEntry[]> {
  const data = await fetchJson<CacheStatusEntryAPI[]>(API_ENDPOINTS.cacheStatus, {
    errorMessage: 'Failed to fetch cache status',
  });
  return (data ?? []).map(transformEntry);
}

export async function clearCache(id: string): Promise<void> {
  await fetchJson<{ cleared: boolean; cache_id: string }>(API_ENDPOINTS.cacheClear(id), {
    method: 'POST',
    errorMessage: `Failed to clear cache ${id}`,
  });
}
