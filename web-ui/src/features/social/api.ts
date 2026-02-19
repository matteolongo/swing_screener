import { API_ENDPOINTS, apiFetch } from '@/lib/api';
import {
  SocialAnalysisResponse,
  SocialAnalysisResponseAPI,
  SocialWarmupStatus,
  SocialWarmupStatusAPI,
  transformSocialAnalysisResponse,
  transformSocialWarmupStatus,
} from './types';

export interface SocialApiError extends Error {
  status: number;
  detail?: string;
}

async function buildApiError(response: Response, fallbackMessage: string): Promise<SocialApiError> {
  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  const detail = typeof payload.detail === 'string' ? payload.detail : undefined;
  const error = new Error(detail || fallbackMessage) as SocialApiError;
  error.status = response.status;
  error.detail = detail;
  return error;
}

export async function analyzeSocial(params: {
  symbol: string;
  maxEvents: number;
  lookbackHours?: number;
}): Promise<SocialAnalysisResponse> {
  const payload: { symbol: string; max_events: number; lookback_hours?: number } = {
    symbol: params.symbol,
    max_events: params.maxEvents,
  };
  if (params.lookbackHours !== undefined) {
    payload.lookback_hours = params.lookbackHours;
  }

  const response = await apiFetch(API_ENDPOINTS.socialAnalyze, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to analyze sentiment');
  }
  const data: SocialAnalysisResponseAPI = await response.json();
  return transformSocialAnalysisResponse(data);
}

export async function fetchSocialWarmupStatus(jobId: string): Promise<SocialWarmupStatus> {
  const response = await apiFetch(API_ENDPOINTS.socialWarmupStatus(jobId));
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fetch social warmup status');
  }
  const data: SocialWarmupStatusAPI = await response.json();
  return transformSocialWarmupStatus(data);
}
