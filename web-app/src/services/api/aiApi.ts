import { createApiClient } from './client';
import type { AIAnalysis, HistoryEntry } from '@/types/api';

const api = createApiClient();

export function analyzeTicker(ticker: string, force?: boolean): Promise<AIAnalysis> {
  const query = force ? '?force=true' : '';
  return api.post<AIAnalysis>(`/api/intelligence/${ticker}${query}`);
}

export function getAIHistory(ticker: string): Promise<{ entries: HistoryEntry[] }> {
  return api.get<{ entries: HistoryEntry[] }>(`/api/intelligence/${ticker}/history`);
}

export function getAILatest(ticker: string): Promise<AIAnalysis> {
  return api.get<AIAnalysis>(`/api/intelligence/${ticker}/latest`);
}

export function postChat(ticker: string, message: string): Promise<unknown> {
  return api.post<unknown>(`/api/intelligence/${ticker}/chat`, { message });
}

export function requestPositionReview(positionId: string, refreshSources?: boolean): Promise<unknown> {
  return api.post<unknown>(`/api/intelligence/position-review/${positionId}`, {
    ...(refreshSources !== undefined && { refresh_sources: refreshSources }),
  });
}
