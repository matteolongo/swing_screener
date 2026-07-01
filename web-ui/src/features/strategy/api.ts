import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
  Strategy,
  StrategyAPI,
  ActiveStrategyRequestAPI,
  StrategyUpdateRequestAPI,
  transformStrategy,
  toStrategyCreateRequest,
  toStrategyUpdateRequest,
} from '@/features/strategy/types';

export interface ValidationWarning {
  parameter: string;
  level: 'danger' | 'warning' | 'info';
  message: string;
}

export interface StrategyValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  safetyScore: number;
  safetyLevel: 'beginner-safe' | 'requires-discipline' | 'expert-only';
  totalWarnings: number;
  dangerCount: number;
  warningCount: number;
  infoCount: number;
}

interface ValidationWarningApi {
  parameter: string;
  level: 'danger' | 'warning' | 'info';
  message: string;
}

interface StrategyValidationResultApi {
  is_valid: boolean;
  warnings: ValidationWarningApi[];
  safety_score: number;
  safety_level: 'beginner-safe' | 'requires-discipline' | 'expert-only';
  total_warnings: number;
  danger_count: number;
  warning_count: number;
  info_count: number;
}

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

export async function validateStrategy(
  strategyPayload: StrategyUpdateRequestAPI,
): Promise<StrategyValidationResult> {
  const data = await fetchJson<StrategyValidationResultApi>(API_ENDPOINTS.strategyValidate, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(strategyPayload),
    errorMessage: 'Failed to validate strategy',
  });
  return transformValidationResult(data);
}

function transformValidationResult(data: StrategyValidationResultApi): StrategyValidationResult {
  return {
    isValid: data.is_valid,
    warnings: data.warnings.map((warning) => ({
      parameter: warning.parameter,
      level: warning.level,
      message: warning.message,
    })),
    safetyScore: data.safety_score,
    safetyLevel: data.safety_level,
    totalWarnings: data.total_warnings,
    dangerCount: data.danger_count,
    warningCount: data.warning_count,
    infoCount: data.info_count,
  };
}
