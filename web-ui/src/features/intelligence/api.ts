import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  IntelligenceEducationGenerateRequest,
  IntelligenceEducationGenerateResponse,
  IntelligenceEducationGenerateResponseAPI,
  IntelligenceEventsResponse,
  IntelligenceEventsResponseAPI,
  IntelligenceConfig,
  IntelligenceConfigAPI,
  IntelligenceOpportunitiesResponse,
  IntelligenceOpportunitiesResponseAPI,
  IntelligenceProviderInfo,
  IntelligenceProviderInfoAPI,
  IntelligenceMetricsResponse,
  IntelligenceMetricsResponseAPI,
  IntelligenceProviderTestRequest,
  IntelligenceProviderTestResponse,
  IntelligenceProviderTestResponseAPI,
  IntelligenceRunLaunchResponse,
  IntelligenceRunLaunchResponseAPI,
  IntelligenceRunRequest,
  IntelligenceRunRequestAPI,
  IntelligenceRunStatus,
  IntelligenceRunStatusAPI,
  IntelligenceSourcesHealthResponse,
  IntelligenceSourcesHealthResponseAPI,
  IntelligenceSymbolSet,
  IntelligenceSymbolSetAPI,
  IntelligenceSymbolSetsResponse,
  IntelligenceSymbolSetsResponseAPI,
  IntelligenceSymbolSetUpsertRequest,
  IntelligenceUpcomingCatalystsResponse,
  IntelligenceUpcomingCatalystsResponseAPI,
  toIntelligenceConfigAPI,
  toEducationGenerateRequestAPI,
  toProviderTestRequestAPI,
  transformEducationGenerateResponse,
  transformIntelligenceEventsResponse,
  transformIntelligenceMetricsResponse,
  transformIntelligenceSourcesHealthResponse,
  transformIntelligenceUpcomingCatalystsResponse,
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

export async function fetchIntelligenceEvents(
  asofDate?: string,
  symbols?: string[],
  eventTypes?: string[],
  minMateriality?: number
): Promise<IntelligenceEventsResponse> {
  const endpoint = new URL(apiUrl(API_ENDPOINTS.intelligenceEvents), window.location.origin);
  if (asofDate) {
    endpoint.searchParams.set('asof_date', asofDate);
  }
  if (symbols && symbols.length > 0) {
    symbols
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => symbol.length > 0)
      .forEach((symbol) => endpoint.searchParams.append('symbols', symbol));
  }
  if (eventTypes && eventTypes.length > 0) {
    eventTypes
      .map((eventType) => eventType.trim().toLowerCase())
      .filter((eventType) => eventType.length > 0)
      .forEach((eventType) => endpoint.searchParams.append('event_types', eventType));
  }
  if (minMateriality != null) {
    endpoint.searchParams.set('min_materiality', String(minMateriality));
  }
  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence events');
  }
  const payload: IntelligenceEventsResponseAPI = await response.json();
  return transformIntelligenceEventsResponse(payload);
}

export async function fetchIntelligenceUpcomingCatalysts(
  asofDate?: string,
  symbols?: string[],
  daysAhead: number = 14
): Promise<IntelligenceUpcomingCatalystsResponse> {
  const endpoint = new URL(apiUrl(API_ENDPOINTS.intelligenceUpcomingCatalysts), window.location.origin);
  if (asofDate) {
    endpoint.searchParams.set('asof_date', asofDate);
  }
  if (symbols && symbols.length > 0) {
    symbols
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => symbol.length > 0)
      .forEach((symbol) => endpoint.searchParams.append('symbols', symbol));
  }
  endpoint.searchParams.set('days_ahead', String(daysAhead));

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch upcoming catalysts');
  }
  const payload: IntelligenceUpcomingCatalystsResponseAPI = await response.json();
  return transformIntelligenceUpcomingCatalystsResponse(payload);
}

export async function fetchIntelligenceSourcesHealth(): Promise<IntelligenceSourcesHealthResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceSourcesHealth));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence sources health');
  }
  const payload: IntelligenceSourcesHealthResponseAPI = await response.json();
  return transformIntelligenceSourcesHealthResponse(payload);
}

export async function fetchIntelligenceMetrics(asofDate?: string): Promise<IntelligenceMetricsResponse> {
  const endpoint = new URL(apiUrl(API_ENDPOINTS.intelligenceMetrics), window.location.origin);
  if (asofDate) {
    endpoint.searchParams.set('asof_date', asofDate);
  }
  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence metrics');
  }
  const payload: IntelligenceMetricsResponseAPI = await response.json();
  return transformIntelligenceMetricsResponse(payload);
}

export async function generateIntelligenceEducation(
  request: IntelligenceEducationGenerateRequest
): Promise<IntelligenceEducationGenerateResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceEducationGenerate), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toEducationGenerateRequestAPI(request)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to generate educational intelligence');
  }
  const payload: IntelligenceEducationGenerateResponseAPI = await response.json();
  return transformEducationGenerateResponse(payload);
}

export async function fetchIntelligenceEducation(
  symbol: string,
  asofDate?: string
): Promise<IntelligenceEducationGenerateResponse> {
  const endpoint = new URL(
    apiUrl(API_ENDPOINTS.intelligenceEducationBySymbol(symbol.trim().toUpperCase())),
    window.location.origin
  );
  if (asofDate) {
    endpoint.searchParams.set('asof_date', asofDate);
  }
  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch educational intelligence');
  }
  const payload: IntelligenceEducationGenerateResponseAPI = await response.json();
  return transformEducationGenerateResponse(payload);
}
