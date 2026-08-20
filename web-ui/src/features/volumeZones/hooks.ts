import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { fetchVolumeAnalysis } from './api';

export const DEFAULT_VOLUME_LOOKBACK = 120;
export const DEFAULT_VOLUME_MIN_RR = 2.0;

export function useVolumeAnalysisQuery(
  ticker: string | null | undefined,
  enabled: boolean = true,
  lookback: number = DEFAULT_VOLUME_LOOKBACK,
  minRr: number = DEFAULT_VOLUME_MIN_RR,
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
