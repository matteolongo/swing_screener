import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import type { Strategy } from '@/features/strategy/types';

export interface StrategyReadiness {
  isReady: boolean;
  hasActiveStrategy: boolean;
  hasValidAccountSize: boolean;
  hasValidRiskParams: boolean;
  isLoading: boolean;
  issues: string[];
}

/**
 * Check if a strategy is properly configured for trading.
 * A strategy is considered "ready" if:
 * - It exists (is active)
 * - Has a valid account size (> 0)
 * - Has valid risk parameters (riskPct > 0, maxPositionPct > 0)
 */
export function isStrategyConfigured(strategy: Strategy | null | undefined): boolean {
  if (!strategy) return false;
  
  const hasValidAccountSize = strategy.risk.accountSize > 0;
  const hasValidRiskParams = 
    strategy.risk.riskPct > 0 && 
    strategy.risk.maxPositionPct > 0;
  
  return hasValidAccountSize && hasValidRiskParams;
}

/**
 * Get detailed strategy readiness information.
 */
export function getStrategyReadiness(
  strategy: Strategy | null | undefined,
  isLoading: boolean
): StrategyReadiness {
  const issues: string[] = [];
  
  if (!strategy) {
    issues.push('No active strategy');
    return {
      isReady: false,
      hasActiveStrategy: false,
      hasValidAccountSize: false,
      hasValidRiskParams: false,
      isLoading,
      issues,
    };
  }
  
  const hasValidAccountSize = strategy.risk.accountSize > 0;
  const hasValidRiskParams = 
    strategy.risk.riskPct > 0 && 
    strategy.risk.maxPositionPct > 0;
  
  if (!hasValidAccountSize) {
    issues.push('Account size must be greater than 0');
  }
  
  if (!hasValidRiskParams) {
    if (strategy.risk.riskPct <= 0) {
      issues.push('Risk percentage must be greater than 0');
    }
    if (strategy.risk.maxPositionPct <= 0) {
      issues.push('Max position percentage must be greater than 0');
    }
  }
  
  const isReady = hasValidAccountSize && hasValidRiskParams;
  
  return {
    isReady,
    hasActiveStrategy: true,
    hasValidAccountSize,
    hasValidRiskParams,
    isLoading,
    issues,
  };
}

/**
 * Hook to check if the active strategy is properly configured for trading.
 * Returns readiness status, loading state, and any configuration issues.
 */
export function useStrategyReadiness(): StrategyReadiness {
  const { data: strategy, isLoading } = useActiveStrategyQuery();
  
  return getStrategyReadiness(strategy, isLoading);
}
