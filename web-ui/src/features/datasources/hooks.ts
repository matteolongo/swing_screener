import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchDataSources, fetchFallbackEvents, probeSource, probeAll } from './api';

export function useDataSources() {
  return useQuery({
    queryKey: queryKeys.datasources(),
    queryFn: fetchDataSources,
    refetchOnWindowFocus: false,
  });
}

export function useFallbackEvents() {
  return useQuery({
    queryKey: queryKeys.datasourcesEvents(),
    queryFn: fetchFallbackEvents,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useProbeSourceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => probeSource(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.datasources() });
    },
  });
}

export function useProbeAllMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => probeAll(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.datasources() });
    },
  });
}
