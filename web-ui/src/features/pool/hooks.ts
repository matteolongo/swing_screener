import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchPresets, fetchReviewQueue, removeFromPool, restoreToPool } from './api';

export function usePresets() {
  return useQuery({
    queryKey: queryKeys.taxonomyPresets(),
    queryFn: fetchPresets,
    staleTime: 60 * 60 * 1000,
  });
}

export function useReviewQueue() {
  return useQuery({
    queryKey: queryKeys.reviewQueue(),
    queryFn: fetchReviewQueue,
  });
}

export function useRemoveFromPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFromPool,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reviewQueue() }),
  });
}

export function useRestoreToPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreToPool,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reviewQueue() }),
  });
}
