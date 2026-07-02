import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
  Strategy,
  StrategyAPI,
  ActiveStrategyRequestAPI,
  transformStrategy,
  toStrategyCreateRequest,
  toStrategyUpdateRequest,
} from '@/features/strategy/types';

export async function fetchStrategies(): Promise<Strategy[]> {
  const data = await fetchJson<StrategyAPI[]>(API_ENDPOINTS.strategy, {
    errorMessage: 'Failed to load strategies',
  });
  return data.map(transformStrategy);
}

export async function fetchActiveStrategy(): Promise<Strategy> {
  const data = await fetchJson<StrategyAPI>(API_ENDPOINTS.strategyActive, {
    errorMessage: 'Failed to load active strategy',
  });
  return transformStrategy(data);
}

export async function setActiveStrategy(strategyId: string): Promise<Strategy> {
  const payload: ActiveStrategyRequestAPI = { strategy_id: strategyId };
  const data = await fetchJson<StrategyAPI>(API_ENDPOINTS.strategyActive, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    errorMessage: 'Failed to update active strategy',
  });
  return transformStrategy(data);
}

export async function updateStrategy(strategy: Strategy): Promise<Strategy> {
  const data = await fetchJson<StrategyAPI>(API_ENDPOINTS.strategyById(strategy.id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toStrategyUpdateRequest(strategy)),
    errorMessage: 'Failed to update strategy',
  });
  return transformStrategy(data);
}

export async function deleteStrategy(strategyId: string): Promise<void> {
  await fetchJson<void>(API_ENDPOINTS.strategyById(strategyId), {
    method: 'DELETE',
    errorMessage: 'Failed to delete strategy',
  });
}

export async function createStrategy(
  strategy: Strategy,
  payload: { id: string; name: string; description?: string }
): Promise<Strategy> {
  const data = await fetchJson<StrategyAPI>(API_ENDPOINTS.strategy, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toStrategyCreateRequest(strategy, payload)),
    errorMessage: 'Failed to create strategy',
  });
  return transformStrategy(data);
}
