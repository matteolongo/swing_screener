/**
 * Daily Review API client and React Query hooks
 */
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  DailyReview,
  DailyReviewAPI,
  transformDailyReview,
} from '@/features/dailyReview/types';

/**
 * Fetch daily review from API
 */
export async function getDailyReview(topN: number = 10, universe?: string | null): Promise<DailyReview> {
  const params = new URLSearchParams();
  params.set('top_n', String(topN));
  if (universe && universe.trim().length > 0) {
    params.set('universe', universe.trim());
  }
  const url = `${apiUrl(API_ENDPOINTS.dailyReview)}?${params.toString()}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch daily review' }));
    throw new Error(error.detail || 'Failed to fetch daily review');
  }
  
  const data: DailyReviewAPI = await response.json();
  return transformDailyReview(data);
}

/**
 * React Query hook for daily review
 */
export function useDailyReview(topN: number = 10, universe?: string | null) {
  return useQuery({
    queryKey: queryKeys.dailyReview(topN, universe),
    queryFn: () => getDailyReview(topN, universe),
    staleTime: 1000 * 60 * 5, // 5 minutes - review data is relatively stable
    refetchOnWindowFocus: false, // Don't refetch on window focus - user is reviewing
  });
}
