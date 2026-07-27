import { useMutation, useQuery } from '@tanstack/react-query';
import { runScreener } from './api';
import { ScreenerRequest, ScreenerResponse, PriceHistoryPoint, CandlePattern, transformCandlePattern } from './types';
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

interface TickerCandlesAPIResponse {
  ticker: string;
  price_history: PriceHistoryPoint[];
  patterns: Array<{
    bar_index: number;
    date: string;
    name: string;
    direction: string;
    key_level: number;
    context: string;
  }>;
}

export interface TickerCandles {
  ticker: string;
  priceHistory: PriceHistoryPoint[];
  patterns: CandlePattern[];
}

async function fetchTickerCandles(ticker: string): Promise<TickerCandles> {
  const raw = await fetchJson<TickerCandlesAPIResponse>(
    API_ENDPOINTS.marketDataCandles(ticker),
    { errorMessage: `Failed to fetch candles for ${ticker}` },
  );
  return {
    ticker: raw.ticker.trim().toUpperCase(),
    priceHistory: raw.price_history,
    patterns: raw.patterns.map(transformCandlePattern),
  };
}

export function useTickerCandles(ticker: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.tickerCandles(ticker),
    queryFn: () => fetchTickerCandles(ticker!),
    enabled: Boolean(ticker),
    staleTime: 5 * 60 * 1000,
  });
}
