import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
  ScreenerRequest,
  ScreenerRunLaunchResponseAPI,
  ScreenerRunStatusResponseAPI,
  ScreenerResponse,
  ScreenerResponseAPI,
  UniversesResponse,
  transformScreenerResponse,
} from './types';

export async function fetchUniverses(): Promise<UniversesResponse> {
  return fetchJson<UniversesResponse>(API_ENDPOINTS.universes, {
    errorMessage: 'Failed to fetch universes',
  });
}

export function toScreenerRequestPayload(request: ScreenerRequest): Record<string, unknown> {
  const tf = request.taxonomyFilter;
  return {
    universe: request.universe,
    tickers: request.tickers,
    top: request.top,
    asof_date: request.asofDate,
    min_price: request.minPrice,
    max_price: request.maxPrice,
    currencies: request.currencies,
    exchange_mics: request.exchangeMics,
    include_otc: request.includeOtc,
    include_held: request.includeHeld,
    instrument_types: request.instrumentTypes,
    breakout_lookback: request.breakoutLookback,
    pullback_ma: request.pullbackMa,
    min_history: request.minHistory,
    require_weekly_uptrend: request.requireWeeklyUptrend,
    force_refresh: request.forceRefresh,
    preset: request.preset,
    taxonomy_filter: tf && {
      region: tf.region,
      market_cap_tier: tf.marketCapTier,
      sector: tf.sector,
      index_memberships: tf.indexMemberships,
      instrument_type_detail: tf.instrumentTypeDetail,
      provider: tf.provider,
      currency: tf.currency,
      exchange_mics: tf.exchangeMics,
      liquidity_tier: tf.liquidityTier,
    },
  };
}

export async function runScreener(request: ScreenerRequest): Promise<ScreenerResponse> {
  const apiRequest = toScreenerRequestPayload(request);

  const res = await fetch(apiUrl(API_ENDPOINTS.screenerRun), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiRequest),
  });

  if (res.status === 202) {
    const launchPayload: ScreenerRunLaunchResponseAPI = await res.json();
    return pollScreenerRunResult(launchPayload.job_id);
  }

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to run screener');
  }
  const apiResponse: ScreenerResponseAPI = await res.json();
  return transformScreenerResponse(apiResponse);
}

// Cold-cache runs on large universes can take well over two minutes, so the
// polling budget is generous; the delay backs off to keep request volume low.
const POLL_BUDGET_MS = 30 * 60 * 1000;
const POLL_INITIAL_DELAY_MS = 1000;
const POLL_MAX_DELAY_MS = 5000;

async function pollScreenerRunResult(jobId: string): Promise<ScreenerResponse> {
  const startedAt = Date.now();
  let delayMs = POLL_INITIAL_DELAY_MS;

  while (Date.now() - startedAt < POLL_BUDGET_MS) {
    const statusPayload = await fetchJson<ScreenerRunStatusResponseAPI>(
      API_ENDPOINTS.screenerRunStatus(jobId),
      { errorMessage: 'Failed to fetch screener run status' }
    );
    if (statusPayload.status === 'completed' && statusPayload.result) {
      return transformScreenerResponse(statusPayload.result);
    }
    if (statusPayload.status === 'error') {
      throw new Error(statusPayload.error || 'Screener run failed');
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 1.5, POLL_MAX_DELAY_MS);
  }

  throw new Error('Screener run timed out. Please try again.');
}
