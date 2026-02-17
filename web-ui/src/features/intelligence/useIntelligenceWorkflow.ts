import { useCallback, useEffect } from 'react';
import { useIntelligenceOpportunitiesScoped, useIntelligenceRunStatus, useRunIntelligenceMutation } from '@/features/intelligence/hooks';

type UseIntelligenceWorkflowArgs = {
  availableSymbols: string[];
  maxSymbols?: number;
  jobId?: string;
  setJobId: (value: string | undefined) => void;
  asofDate?: string;
  setAsofDate: (value: string | undefined) => void;
  runSymbols: string[];
  setRunSymbols: (value: string[]) => void;
};

export function useIntelligenceWorkflow({
  availableSymbols,
  maxSymbols,
  jobId,
  setJobId,
  asofDate,
  setAsofDate,
  runSymbols,
  setRunSymbols,
}: UseIntelligenceWorkflowArgs) {
  const runMutation = useRunIntelligenceMutation((launch) => {
    setJobId(launch.jobId);
    setAsofDate(undefined);
  });
  const statusQuery = useIntelligenceRunStatus(jobId);
  const status = statusQuery.data;
  const opportunitiesQuery = useIntelligenceOpportunitiesScoped(
    asofDate,
    runSymbols.length > 0 ? runSymbols : undefined,
    Boolean(asofDate)
  );
  const opportunities = opportunitiesQuery.data?.opportunities ?? [];

  useEffect(() => {
    if (status?.status === 'completed' && status.asofDate) {
      setAsofDate(status.asofDate);
    }
  }, [setAsofDate, status?.asofDate, status?.status]);

  const run = useCallback(() => {
    if (!availableSymbols.length) {
      return;
    }
    const scopedSymbols = maxSymbols != null ? availableSymbols.slice(0, maxSymbols) : availableSymbols;
    setRunSymbols(scopedSymbols);
    runMutation.mutate({ symbols: scopedSymbols });
  }, [availableSymbols, maxSymbols, runMutation, setRunSymbols]);

  const reset = useCallback(() => {
    setJobId(undefined);
    setAsofDate(undefined);
    setRunSymbols([]);
  }, [setAsofDate, setJobId, setRunSymbols]);

  return {
    canRun: availableSymbols.length > 0,
    run,
    reset,
    runMutation,
    statusQuery,
    status,
    opportunitiesQuery,
    opportunities,
    asofDate,
    jobId,
  };
}
