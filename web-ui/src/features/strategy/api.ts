import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  Strategy,
  StrategyAPI,
  ActiveStrategyRequestAPI,
  transformStrategy,
  toStrategyCreateRequest,
  toStrategyUpdateRequest,
} from '@/features/strategy/types';

export async function fetchStrategies(): Promise<Strategy[]> {
  const res = await fetch(apiUrl(API_ENDPOINTS.strategy));
  if (!res.ok) throw new Error('Failed to load strategies');
  const data: StrategyAPI[] = await res.json();
  return data.map(transformStrategy);
}

export async function fetchActiveStrategy(): Promise<Strategy> {
  const res = await fetch(apiUrl(API_ENDPOINTS.strategyActive));
  if (!res.ok) throw new Error('Failed to load active strategy');
  const data: StrategyAPI = await res.json();
  return transformStrategy(data);
}

export async function setActiveStrategy(strategyId: string): Promise<Strategy> {
  const payload: ActiveStrategyRequestAPI = { strategy_id: strategyId };
  const res = await fetch(apiUrl(API_ENDPOINTS.strategyActive), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to update active strategy');
  }
  const data: StrategyAPI = await res.json();
  return transformStrategy(data);
}

export async function updateStrategy(strategy: Strategy): Promise<Strategy> {
  const res = await fetch(apiUrl(API_ENDPOINTS.strategyById(strategy.id)), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toStrategyUpdateRequest(strategy)),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to update strategy');
  }
  const data: StrategyAPI = await res.json();
  return transformStrategy(data);
}

export async function deleteStrategy(strategyId: string): Promise<void> {
  const res = await fetch(apiUrl(API_ENDPOINTS.strategyById(strategyId)), {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to delete strategy');
  }
}

export async function createStrategy(
  strategy: Strategy,
  payload: { id: string; name: string; description?: string }
): Promise<Strategy> {
  const res = await fetch(apiUrl(API_ENDPOINTS.strategy), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toStrategyCreateRequest(strategy, payload)),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to create strategy');
  }
  const data: StrategyAPI = await res.json();
  return transformStrategy(data);
}
