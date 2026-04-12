import { API_ENDPOINTS, apiUrl } from '@/lib/api';
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
  const res = await fetch(apiUrl(API_ENDPOINTS.universes));
  if (!res.ok) throw new Error('Failed to fetch universes');
  return res.json();
}

export async function runScreener(request: ScreenerRequest): Promise<ScreenerResponse> {
  const apiRequest = {
    universe: request.universe,
    tickers: request.tickers,
    top: request.top,
    asof_date: request.asofDate,
    min_price: request.minPrice,
    max_price: request.maxPrice,
    currencies: request.currencies,
    exchange_mics: request.exchangeMics,
    include_otc: request.includeOtc,
    instrument_types: request.instrumentTypes,
    breakout_lookback: request.breakoutLookback,
    pullback_ma: request.pullbackMa,
    min_history: request.minHistory,
  };

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

async function pollScreenerRunResult(jobId: string): Promise<ScreenerResponse> {
  const maxAttempts = 120;
  const delayMs = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(apiUrl(API_ENDPOINTS.screenerRunStatus(jobId)));
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to fetch screener run status');
    }

    const statusPayload: ScreenerRunStatusResponseAPI = await res.json();
    if (statusPayload.status === 'completed' && statusPayload.result) {
      return transformScreenerResponse(statusPayload.result);
    }
    if (statusPayload.status === 'error') {
      throw new Error(statusPayload.error || 'Screener run failed');
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('Screener run timed out. Please try again.');
}
