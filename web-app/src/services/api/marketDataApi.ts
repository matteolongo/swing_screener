import { createApiClient } from './client';
import type { PriceHistoryPoint, PatternAnnotation } from '@/types/api';

const api = createApiClient();

export interface CandlesResponse {
  price_history: PriceHistoryPoint[];
  patterns: PatternAnnotation[];
}

export function getCandles(ticker: string): Promise<CandlesResponse> {
  return api.get<CandlesResponse>(`/api/market-data/${ticker}/candles`);
}

export function getVolumeAnalysis(ticker: string): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>(`/api/market-data/${ticker}/volume-analysis`);
}
