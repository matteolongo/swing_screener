import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import {
  fetchEnrichStatus,
  rebuildPool,
  refreshAllUniverses,
  startEnrich,
} from './admin';

export function useRefreshAllUniverses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshAllUniverses,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.universes() });
    },
  });
}

export function useRebuildPool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rebuildPool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue() });
    },
  });
}

const ENRICH_POLL_MS = 3000;

export function useEnrichTaxonomy() {
  const [jobId, setJobId] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: startEnrich,
    onSuccess: (id) => setJobId(id),
  });

  const statusQuery = useQuery({
    queryKey: ['pool-enrich', jobId],
    queryFn: () => fetchEnrichStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'done' || status === 'failed' ? false : ENRICH_POLL_MS;
    },
  });

  const reset = () => {
    setJobId(null);
    startMutation.reset();
  };

  return {
    start: () => startMutation.mutate(),
    reset,
    jobId,
    status: statusQuery.data,
    isStarting: startMutation.isPending,
    startError: startMutation.error,
    statusError: statusQuery.error,
  };
}
