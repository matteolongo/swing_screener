import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import type { UniversesResponse, UniverseSummary } from '@/features/screener/types';
import type { UniverseDetail, UniverseRefreshPreview } from './types';

export async function fetchUniverseCatalog(): Promise<UniversesResponse> {
  const res = await fetch(apiUrl(API_ENDPOINTS.universes));
  if (!res.ok) throw new Error('Failed to fetch universe catalog');
  return res.json();
}

export async function fetchUniverseDetail(id: string): Promise<UniverseDetail> {
  const res = await fetch(apiUrl(API_ENDPOINTS.universeById(id)));
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch universe detail');
  }
  return res.json();
}

export async function refreshUniverse(id: string, apply = false): Promise<UniverseRefreshPreview> {
  const res = await fetch(apiUrl(API_ENDPOINTS.universeRefresh(id)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to refresh universe');
  }
  return res.json();
}

export async function updateUniverseBenchmark(id: string, benchmark: string): Promise<UniverseSummary> {
  const res = await fetch(apiUrl(API_ENDPOINTS.universeBenchmark(id)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ benchmark }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update universe benchmark');
  }
  return res.json();
}
