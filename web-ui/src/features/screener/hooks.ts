import { useMutation, useQuery } from '@tanstack/react-query';
import { runScreener } from './api';
import {
  ScreenerRequest,
  ScreenerResponse,
  transformTickerCandles,
  type TickerCandles,
  type TickerCandlesAPIResponse,
} from './types';
import { queryKeys } from '@/lib/queryKeys';
import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';

export function useRunScreenerMutation(
  onSuccess?: (data: ScreenerResponse, request: ScreenerRequest) => void,
  onError?: (error: unknown) => void,
) {
  return useMutation({
    mutationFn: (request: ScreenerRequest) => runScreener(request),
    onSuccess: (data, request) => onSuccess?.(data, request),
    onError,
  });
}

async function fetchTickerCandles(ticker: string): Promise<TickerCandles> {
  const normalized = ticker.trim().toUpperCase();
  const raw = await fetchJson<TickerCandlesAPIResponse>(
    API_ENDPOINTS.marketDataCandles(normalized),
    { errorMessage: `Failed to fetch candles for ${ticker}` },
  );
  return transformTickerCandles(raw, normalized);
}

export function useTickerCandles(ticker: string | null | undefined) {
  const normalized = ticker?.trim().toUpperCase();
  return useQuery({
    queryKey: queryKeys.tickerCandles(normalized),
    queryFn: () => fetchTickerCandles(normalized!),
    enabled: Boolean(normalized),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
