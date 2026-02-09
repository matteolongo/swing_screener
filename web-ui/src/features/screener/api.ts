import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  ScreenerRequest,
  ScreenerResponse,
  ScreenerResponseAPI,
  UniversesResponse,
  transformScreenerResponse,
} from './types';

export async function fetchUniverses(): Promise<UniversesResponse> {
  const res = await fetch(apiUrl(API_ENDPOINTS.screenerUniverses));
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
    breakout_lookback: request.breakoutLookback,
    pullback_ma: request.pullbackMa,
    min_history: request.minHistory,
  };

  const res = await fetch(apiUrl(API_ENDPOINTS.screenerRun), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiRequest),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to run screener');
  }
  const apiResponse: ScreenerResponseAPI = await res.json();
  return transformScreenerResponse(apiResponse);
}
