import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import {
  EnrichStatus,
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
      // Rebuild adds/removes pool symbols and shifts member counts.
      queryClient.invalidateQueries({ queryKey: queryKeys.universes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue() });
    },
  });
}

const ENRICH_POLL_MS = 3000;
const ENRICH_JOB_STORAGE_KEY = 'pool.enrichJobId';

function readStoredJobId(): string | null {
  try {
    return localStorage.getItem(ENRICH_JOB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeJobId(jobId: string | null): void {
  try {
    if (jobId) localStorage.setItem(ENRICH_JOB_STORAGE_KEY, jobId);
    else localStorage.removeItem(ENRICH_JOB_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

export function useEnrichTaxonomy() {
  // Persisted so the job survives a PoolTab unmount (tab switch) or page reload,
  // and resumes polling on remount instead of being orphaned.
  const [jobId, setJobId] = useState<string | null>(() => readStoredJobId());

  const startMutation = useMutation({
    mutationFn: startEnrich,
    onSuccess: (id) => {
      storeJobId(id);
      setJobId(id);
    },
  });

  const statusQuery = useQuery<EnrichStatus>({
    queryKey: ['pool-enrich', jobId],
    queryFn: () => fetchEnrichStatus(jobId as string),
    enabled: Boolean(jobId),
    retry: 1,
    refetchInterval: (query) => {
      // Stop on a terminal status or a persistent fetch error so we never poll
      // a lost/unknown job forever.
      if (query.state.status === 'error') return false;
      const status = query.state.data?.status;
      return status === 'done' || status === 'failed' ? false : ENRICH_POLL_MS;
    },
  });

  const reset = () => {
    storeJobId(null);
    setJobId(null);
    startMutation.reset();
  };

  const start = () => {
    startMutation.reset();
    startMutation.mutate();
  };

  const status = statusQuery.data;
  // Running only while we believe a job is genuinely in flight: a status-fetch
  // error means the job is unreachable, so the button must re-enable.
  const isRunning =
    Boolean(jobId) &&
    !statusQuery.isError &&
    (status === undefined || status.status === 'running');

  return {
    start,
    reset,
    jobId,
    status,
    isStarting: startMutation.isPending,
    isRunning,
    startError: startMutation.error,
    statusError: statusQuery.isError,
  };
}
