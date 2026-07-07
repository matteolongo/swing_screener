import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { fetchVolumeAnalysis } from './api';

const DEFAULT_LOOKBACK = 120;
const DEFAULT_MIN_RR = 2.0;

export function useVolumeAnalysisQuery(
  ticker: string | null | undefined,
  enabled: boolean = true,
  lookback: number = DEFAULT_LOOKBACK,
  minRr: number = DEFAULT_MIN_RR,
) {
  const normalized = ticker?.trim().toUpperCase();
  return useQuery({
    queryKey: queryKeys.volumeAnalysis(normalized, lookback, minRr),
    queryFn: () => fetchVolumeAnalysis(normalized as string, lookback, minRr),
    enabled: Boolean(normalized) && enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
