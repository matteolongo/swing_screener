import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import type { UniversesResponse, UniverseSummary } from '@/features/screener/types';
import type { SymbolDiscoveryRequest, SymbolDiscoveryResponse, UniverseDetail, UniverseRefreshPreview } from './types';

export async function fetchUniverseCatalog(): Promise<UniversesResponse> {
  return fetchJson<UniversesResponse>(API_ENDPOINTS.universes, {
    errorMessage: 'Failed to fetch universe catalog',
  });
}

export async function fetchUniverseDetail(id: string): Promise<UniverseDetail> {
  return fetchJson<UniverseDetail>(API_ENDPOINTS.universeById(id), {
    errorMessage: 'Failed to fetch universe detail',
  });
}

export async function refreshUniverse(id: string, apply = false): Promise<UniverseRefreshPreview> {
  return fetchJson<UniverseRefreshPreview>(API_ENDPOINTS.universeRefresh(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply }),
    errorMessage: 'Failed to refresh universe',
  });
}

export async function updateUniverseBenchmark(id: string, benchmark: string): Promise<UniverseSummary> {
  return fetchJson<UniverseSummary>(API_ENDPOINTS.universeBenchmark(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ benchmark }),
    errorMessage: 'Failed to update universe benchmark',
  });
}

export async function discoverSymbols(request: SymbolDiscoveryRequest): Promise<SymbolDiscoveryResponse> {
  return fetchJson<SymbolDiscoveryResponse>(API_ENDPOINTS.universeDiscover, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    errorMessage: 'Failed to discover symbols',
  });
}
