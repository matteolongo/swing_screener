import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  SocialAnalysisResponse,
  SocialAnalysisResponseAPI,
  SocialWarmupStatus,
  SocialWarmupStatusAPI,
  transformSocialAnalysisResponse,
  transformSocialWarmupStatus,
} from './types';

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

  const response = await fetch(apiUrl(API_ENDPOINTS.socialAnalyze), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to analyze sentiment');
  }
  const data: SocialAnalysisResponseAPI = await response.json();
  return transformSocialAnalysisResponse(data);
}

export async function fetchSocialWarmupStatus(jobId: string): Promise<SocialWarmupStatus> {
  const response = await fetch(apiUrl(API_ENDPOINTS.socialWarmupStatus(jobId)));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch social warmup status');
  }
  const data: SocialWarmupStatusAPI = await response.json();
  return transformSocialWarmupStatus(data);
}
