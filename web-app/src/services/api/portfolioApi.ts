import { createApiClient } from './client';
import type { Position, DailyReview } from '@/types/api';

const api = createApiClient();

export function getPositions(): Promise<Position[]> {
  return api.get<Position[]>('/api/portfolio/positions');
}

export function getPositionMetrics(positionId: string): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>(`/api/portfolio/positions/${positionId}/metrics`);
}

export function getStopSuggestion(positionId: string): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>(`/api/portfolio/positions/${positionId}/stop-suggestion`);
}

export function getStopPreview(positionId: string, stopPrice: number): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>(
    `/api/portfolio/positions/${positionId}/stop-preview?stop=${stopPrice}`,
  );
}

export function updateStop(positionId: string, stopPrice: number): Promise<Position> {
  return api.put<Position>(`/api/portfolio/positions/${positionId}/stop`, { stop_price: stopPrice });
}

export function getDailyReview(): Promise<DailyReview> {
  return api.get<DailyReview>('/api/daily-review');
}
