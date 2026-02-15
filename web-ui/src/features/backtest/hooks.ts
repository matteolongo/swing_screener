import { notifyManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteSimulation, fetchSimulations, fetchSimulation, runBacktest } from './api';
import { FullBacktestParams, FullBacktestResponse } from './types';
import { queryKeys } from '@/lib/queryKeys';

export function useBacktestSimulations() {
  return useQuery({
    queryKey: queryKeys.backtestSimulations(),
    queryFn: fetchSimulations,
  });
}

export function useRunBacktestMutation(onSuccess?: (data: FullBacktestResponse) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: FullBacktestParams) => runBacktest(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backtestSimulations() });
      notifyManager.schedule(() => {
        onSuccess?.(data);
      });
    },
  });
}

export function useLoadSimulation() {
  return useMutation({
    mutationFn: (id: string) => fetchSimulation(id),
  });
}

export function useDeleteSimulationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSimulation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backtestSimulations() });
    },
  });
}
