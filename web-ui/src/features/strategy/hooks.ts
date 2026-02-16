import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStrategy,
  deleteStrategy,
  fetchActiveStrategy,
  fetchStrategies,
  setActiveStrategy,
  updateStrategy,
} from '@/features/strategy/api';
import type { Strategy } from '@/features/strategy/types';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateStrategyQueries } from '@/lib/queryInvalidation';

export function useStrategiesQuery() {
  return useQuery({
    queryKey: queryKeys.strategies(),
    queryFn: fetchStrategies,
  });
}

export function useActiveStrategyQuery() {
  return useQuery({
    queryKey: queryKeys.strategyActive(),
    queryFn: fetchActiveStrategy,
  });
}

export function useSetActiveStrategyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (strategyId: string) => setActiveStrategy(strategyId),
    onSuccess: async () => {
      await invalidateStrategyQueries(queryClient);
    },
  });
}

export function useUpdateStrategyMutation(onSuccess?: (updated: Strategy) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStrategy,
    onSuccess: async (updated) => {
      await invalidateStrategyQueries(queryClient);
      onSuccess?.(updated);
    },
  });
}

export function useCreateStrategyMutation(
  onSuccess?: (created: Strategy) => void,
  factory?: (payload: { id: string; name: string; description?: string }) => Promise<Strategy>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; name: string; description?: string }) => {
      if (!factory) {
        throw new Error('Strategy create factory not configured');
      }
      return factory(payload);
    },
    onSuccess: async (created) => {
      await invalidateStrategyQueries(queryClient);
      onSuccess?.(created);
    },
  });
}

export function useDeleteStrategyMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (strategyId: string) => deleteStrategy(strategyId),
    onSuccess: async () => {
      await invalidateStrategyQueries(queryClient);
      onSuccess?.();
    },
  });
}

export function createStrategyFromDraft(
  draft: Strategy | null,
  payload: { id: string; name: string; description?: string },
) {
  if (!draft) throw new Error('No strategy selected');
  return createStrategy(draft, payload);
}

// Re-export strategy readiness utilities for convenience
export { 
  useStrategyReadiness, 
  isStrategyConfigured, 
  getStrategyReadiness 
} from './useStrategyReadiness';
export type { StrategyReadiness } from './useStrategyReadiness';

