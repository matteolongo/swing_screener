import { useCallback, useEffect, useState } from 'react';
import { getDailyReview } from '../services/api/portfolioApi';
import type { DailyReview } from '../types/api';

export function useDailyReview() {
  const [data, setData] = useState<DailyReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDailyReview();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch daily review');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 60000);
    return () => clearInterval(interval);
  }, [refetch]);

  return {
    kpis: data?.kpis ?? [],
    positions: data?.positions ?? [],
    candidates: data?.candidates ?? [],
    alerts: data?.alerts ?? [],
    steps: data?.steps ?? [],
    isLoading,
    error,
    refetch,
  };
}
