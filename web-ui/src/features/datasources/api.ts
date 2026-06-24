import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import type {
  DataSource,
  DataSourcesInventoryAPI,
  ProbeResult,
  ProbeResultAPI,
  FallbackEvent,
  FallbackEventsAPI,
} from './types';
import { transformDataSource, transformProbeResult, transformFallbackEvent } from './types';

export async function fetchDataSources(): Promise<DataSource[]> {
  const data = await fetchJson<DataSourcesInventoryAPI>(API_ENDPOINTS.datasources, {
    errorMessage: 'Failed to fetch data sources',
  });
  return (data.sources ?? []).map(transformDataSource);
}

export async function probeSource(id: string): Promise<ProbeResult> {
  const data = await fetchJson<ProbeResultAPI>(API_ENDPOINTS.datasourceProbe(id), {
    method: 'POST',
    errorMessage: 'Failed to probe data source',
  });
  return transformProbeResult(data);
}

export async function probeAll(): Promise<ProbeResult[]> {
  const data = await fetchJson<ProbeResultAPI[]>(API_ENDPOINTS.datasourcesProbeAll, {
    method: 'POST',
    errorMessage: 'Failed to probe data sources',
  });
  return (data ?? []).map(transformProbeResult);
}

export async function fetchFallbackEvents(): Promise<FallbackEvent[]> {
  const data = await fetchJson<FallbackEventsAPI>(API_ENDPOINTS.datasourcesEvents, {
    errorMessage: 'Failed to fetch fallback events',
  });
  return (data.events ?? []).map(transformFallbackEvent);
}
