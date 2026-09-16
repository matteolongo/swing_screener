import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchTickerCandles, runScreener } from './api';
import {
  ScreenerRequest,
  ScreenerResponse,
} from './types';
import { queryKeys } from '@/lib/queryKeys';

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
