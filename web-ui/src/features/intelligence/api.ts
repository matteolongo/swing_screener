import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  IntelligenceOpportunitiesResponse,
  IntelligenceOpportunitiesResponseAPI,
  IntelligenceRunLaunchResponse,
  IntelligenceRunLaunchResponseAPI,
  IntelligenceRunRequest,
  IntelligenceRunRequestAPI,
  IntelligenceRunStatus,
  IntelligenceRunStatusAPI,
  transformIntelligenceOpportunitiesResponse,
  transformIntelligenceRunLaunchResponse,
  transformIntelligenceRunStatus,
} from '@/features/intelligence/types';

function toRequestPayload(request: IntelligenceRunRequest): IntelligenceRunRequestAPI {
  return {
    symbols: request.symbols,
    technical_readiness: request.technicalReadiness,
    providers: request.providers,
    lookback_hours: request.lookbackHours,
    max_opportunities: request.maxOpportunities,
  };
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
  asofDate?: string
): Promise<IntelligenceOpportunitiesResponse> {
  const endpoint = new URL(apiUrl(API_ENDPOINTS.intelligenceOpportunities), window.location.origin);
  if (asofDate) {
    endpoint.searchParams.set('asof_date', asofDate);
  }

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch intelligence opportunities');
  }
  const payload: IntelligenceOpportunitiesResponseAPI = await response.json();
  return transformIntelligenceOpportunitiesResponse(payload);
}

