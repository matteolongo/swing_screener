import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchConfig, fetchConfigDefaults, updateConfig } from '@/features/config/api';
import { queryKeys } from '@/lib/queryKeys';

export function useConfigQuery() {
  return useQuery({
    queryKey: queryKeys.config(),
    queryFn: fetchConfig,
  });
}

export function useConfigDefaultsQuery() {
  return useQuery({
    queryKey: queryKeys.configDefaults(),
    queryFn: fetchConfigDefaults,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateConfig,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.config() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.configDefaults() }),
      ]);
    },
  });
}
