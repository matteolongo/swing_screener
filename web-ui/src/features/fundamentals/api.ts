import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  DegiroAuditRun,
  FundamentalSnapshot,
  FundamentalSnapshotAPI,
  FundamentalsCompareRequest,
  FundamentalsCompareRequestAPI,
  FundamentalsCompareResponse,
  FundamentalsCompareResponseAPI,
  FundamentalsConfig,
  FundamentalsConfigAPI,
  FundamentalsWarmupLaunchResponse,
  FundamentalsWarmupLaunchResponseAPI,
  FundamentalsWarmupRequest,
  FundamentalsWarmupStatus,
  FundamentalsWarmupStatusAPI,
  toFundamentalsWarmupRequestAPI,
  transformDegiroAuditRun,
  transformFundamentalSnapshot,
  transformFundamentalsCompareResponse,
  transformFundamentalsConfig,
  transformFundamentalsWarmupLaunchResponse,
  transformFundamentalsWarmupStatus,
} from '@/features/fundamentals/types';

function toComparePayload(request: FundamentalsCompareRequest): FundamentalsCompareRequestAPI {
  return {
    symbols: request.symbols,
    force_refresh: request.forceRefresh,
  };
}

export async function fetchFundamentalsConfig(): Promise<FundamentalsConfig> {
  const response = await fetch(apiUrl(API_ENDPOINTS.fundamentalsConfig));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch fundamentals config');
  }
  const payload: FundamentalsConfigAPI = await response.json();
  return transformFundamentalsConfig(payload);
}

export async function fetchFundamentalSnapshot(
  symbol: string,
  refresh: boolean = false
): Promise<FundamentalSnapshot> {
  const endpoint = new URL(apiUrl(API_ENDPOINTS.fundamentalsSnapshot(symbol)), window.location.origin);
  if (refresh) {
    endpoint.searchParams.set('refresh', 'true');
  }
  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to fetch fundamentals for ${symbol}`);
  }
  const payload: FundamentalSnapshotAPI = await response.json();
  return transformFundamentalSnapshot(payload);
}

export async function compareFundamentals(
  request: FundamentalsCompareRequest
): Promise<FundamentalsCompareResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.fundamentalsCompare), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toComparePayload(request)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to compare fundamentals');
  }
  const payload: FundamentalsCompareResponseAPI = await response.json();
  return transformFundamentalsCompareResponse(payload);
}

export async function startFundamentalsWarmup(
  request: FundamentalsWarmupRequest
): Promise<FundamentalsWarmupLaunchResponse> {
  const response = await fetch(apiUrl(API_ENDPOINTS.fundamentalsWarmup), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toFundamentalsWarmupRequestAPI(request)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to start fundamentals warmup');
  }
  const payload: FundamentalsWarmupLaunchResponseAPI = await response.json();
  return transformFundamentalsWarmupLaunchResponse(payload);
}

export async function fetchDegiroCapabilityAudit(symbols: string[]): Promise<DegiroAuditRun> {
  const response = await fetch(apiUrl(API_ENDPOINTS.degiroCapabilityAudit), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols, include_quotes: true, include_news: true, include_agenda: true }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'DeGiro capability audit failed');
  }
  const payload = await response.json();
  return transformDegiroAuditRun(payload);
}

export async function fetchDegiroPortfolioAudit(): Promise<DegiroAuditRun> {
  const response = await fetch(apiUrl(API_ENDPOINTS.degiroPortfolioAudit), { method: 'POST' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'DeGiro portfolio audit failed');
  }
  const payload = await response.json();
  return transformDegiroAuditRun(payload);
}

export async function fetchFundamentalsWarmupStatus(jobId: string): Promise<FundamentalsWarmupStatus> {
  const response = await fetch(apiUrl(API_ENDPOINTS.fundamentalsWarmupStatus(jobId)));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch fundamentals warmup status');
  }
  const payload: FundamentalsWarmupStatusAPI = await response.json();
  return transformFundamentalsWarmupStatus(payload);
}
