import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { fetchUniverseCatalog, fetchUniverseDetail, refreshUniverse, updateUniverseBenchmark } from './api';

export function useUniverseCatalog() {
  return useQuery({
    queryKey: queryKeys.universes(),
    queryFn: fetchUniverseCatalog,
  });
}

export function useUniverseDetail(universeId: string | null) {
  return useQuery({
    queryKey: queryKeys.universeDetail(universeId),
    queryFn: () => fetchUniverseDetail(universeId || ''),
    enabled: Boolean(universeId),
  });
}

export function useRefreshUniverseMutation(universeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ apply }: { apply: boolean }) => refreshUniverse(universeId || '', apply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.universes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.universeDetail(universeId) });
    },
  });
}

export function useUpdateUniverseBenchmarkMutation(universeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ benchmark }: { benchmark: string }) => updateUniverseBenchmark(universeId || '', benchmark),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.universes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.universeDetail(universeId) });
    },
  });
}
