import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
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
  const payload = await fetchJson<FundamentalsConfigAPI>(API_ENDPOINTS.fundamentalsConfig, {
    errorMessage: 'Failed to fetch fundamentals config',
  });
  return transformFundamentalsConfig(payload);
}

export async function fetchFundamentalSnapshot(
  symbol: string,
  refresh: boolean = false
): Promise<FundamentalSnapshot> {
  const endpoint = refresh
    ? `${API_ENDPOINTS.fundamentalsSnapshot(symbol)}?refresh=true`
    : API_ENDPOINTS.fundamentalsSnapshot(symbol);
  const payload = await fetchJson<FundamentalSnapshotAPI>(endpoint, {
    errorMessage: `Failed to fetch fundamentals for ${symbol}`,
  });
  return transformFundamentalSnapshot(payload);
}

export async function compareFundamentals(
  request: FundamentalsCompareRequest
): Promise<FundamentalsCompareResponse> {
  const payload = await fetchJson<FundamentalsCompareResponseAPI>(API_ENDPOINTS.fundamentalsCompare, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toComparePayload(request)),
    errorMessage: 'Failed to compare fundamentals',
  });
  return transformFundamentalsCompareResponse(payload);
}

export async function startFundamentalsWarmup(
  request: FundamentalsWarmupRequest
): Promise<FundamentalsWarmupLaunchResponse> {
  const payload = await fetchJson<FundamentalsWarmupLaunchResponseAPI>(API_ENDPOINTS.fundamentalsWarmup, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toFundamentalsWarmupRequestAPI(request)),
    errorMessage: 'Failed to start fundamentals warmup',
  });
  return transformFundamentalsWarmupLaunchResponse(payload);
}

export async function fetchFundamentalsWarmupStatus(jobId: string): Promise<FundamentalsWarmupStatus> {
  const payload = await fetchJson<FundamentalsWarmupStatusAPI>(API_ENDPOINTS.fundamentalsWarmupStatus(jobId), {
    errorMessage: 'Failed to fetch fundamentals warmup status',
  });
  return transformFundamentalsWarmupStatus(payload);
}
