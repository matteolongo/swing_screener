import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  IntelligenceConfig,
  IntelligenceConfigAPI,
  IntelligenceOpportunitiesResponse,
  IntelligenceOpportunitiesResponseAPI,
  IntelligenceProviderInfo,
  IntelligenceProviderInfoAPI,
  IntelligenceProviderTestRequest,
  IntelligenceProviderTestResponse,
  IntelligenceProviderTestResponseAPI,
  IntelligenceRunLaunchResponse,
  IntelligenceRunLaunchResponseAPI,
  IntelligenceRunRequest,
  IntelligenceRunRequestAPI,
  IntelligenceRunStatus,
  IntelligenceRunStatusAPI,
  IntelligenceSymbolSet,
  IntelligenceSymbolSetAPI,
  IntelligenceSymbolSetsResponse,
  IntelligenceSymbolSetsResponseAPI,
  IntelligenceSymbolSetUpsertRequest,
  toIntelligenceConfigAPI,
  toProviderTestRequestAPI,
  transformIntelligenceConfig,
  transformIntelligenceOpportunitiesResponse,
  transformIntelligenceRunLaunchResponse,
  transformIntelligenceRunStatus,
  transformProviderInfo,
  transformProviderTestResponse,
  transformSymbolSet,
  transformSymbolSetsResponse,
} from '@/features/intelligence/types';

function toRequestPayload(request: IntelligenceRunRequest): IntelligenceRunRequestAPI {
  return {
    symbols: request.symbols,
    symbol_set_id: request.symbolSetId,
    technical_readiness: request.technicalReadiness,
    providers: request.providers,
    lookback_hours: request.lookbackHours,
    max_opportunities: request.maxOpportunities,
  };
}

export async function fetchIntelligenceConfig(): Promise<IntelligenceConfig> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceConfig));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence config');
  }
  const payload: IntelligenceConfigAPI = await response.json();
  return transformIntelligenceConfig(payload);
}

export async function updateIntelligenceConfig(config: IntelligenceConfig): Promise<IntelligenceConfig> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceConfig), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toIntelligenceConfigAPI(config)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update intelligence config');
  }
  const payload: IntelligenceConfigAPI = await response.json();
  return transformIntelligenceConfig(payload);
}

export async function fetchIntelligenceProviders(): Promise<IntelligenceProviderInfo[]> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceProviders));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence providers');
  }
  const payload: IntelligenceProviderInfoAPI[] = await response.json();
  return payload.map(transformProviderInfo);
}

export async function testIntelligenceProvider(
  request: IntelligenceProviderTestRequest
): Promise<IntelligenceProviderTestResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceProviderTest), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toProviderTestRequestAPI(request)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to test intelligence provider');
  }
  const payload: IntelligenceProviderTestResponseAPI = await response.json();
  return transformProviderTestResponse(payload);
}

export async function fetchIntelligenceSymbolSets(): Promise<IntelligenceSymbolSetsResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceSymbolSets));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence symbol sets');
  }
  const payload: IntelligenceSymbolSetsResponseAPI = await response.json();
  return transformSymbolSetsResponse(payload);
}

export async function createIntelligenceSymbolSet(
  request: IntelligenceSymbolSetUpsertRequest
): Promise<IntelligenceSymbolSet> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceSymbolSets), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to create symbol set');
  }
  const payload: IntelligenceSymbolSetAPI = await response.json();
  return transformSymbolSet(payload);
}

export async function updateIntelligenceSymbolSet(
  id: string,
  request: IntelligenceSymbolSetUpsertRequest
): Promise<IntelligenceSymbolSet> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceSymbolSetById(id)), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update symbol set');
  }
  const payload: IntelligenceSymbolSetAPI = await response.json();
  return transformSymbolSet(payload);
}

export async function deleteIntelligenceSymbolSet(id: string): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceSymbolSetById(id)), {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to delete symbol set');
  }
}

export async function runIntelligence(
  request: IntelligenceRunRequest
): Promise<IntelligenceRunLaunchResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceRun), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toRequestPayload(request)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to start intelligence run');
  }
  const payload: IntelligenceRunLaunchResponseAPI = await response.json();
  return transformIntelligenceRunLaunchResponse(payload);
}

export async function fetchIntelligenceRunStatus(jobId: string): Promise<IntelligenceRunStatus> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceRunStatus(jobId)));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence run status');
  }
  const payload: IntelligenceRunStatusAPI = await response.json();
  return transformIntelligenceRunStatus(payload);
}

export async function fetchIntelligenceOpportunities(
  asofDate?: string,
  symbols?: string[]
): Promise<IntelligenceOpportunitiesResponse> {
  const endpoint = new URL(apiUrl(API_ENDPOINTS.intelligenceOpportunities), window.location.origin);
  if (asofDate) {
    endpoint.searchParams.set('asof_date', asofDate);
  }
  if (symbols && symbols.length > 0) {
    symbols
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => symbol.length > 0)
      .forEach((symbol) => endpoint.searchParams.append('symbols', symbol));
  }

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence opportunities');
  }
  const payload: IntelligenceOpportunitiesResponseAPI = await response.json();
  return transformIntelligenceOpportunitiesResponse(payload);
}
