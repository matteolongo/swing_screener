/**
 * Daily Review API client and React Query hooks
 */
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  DailyReview,
  DailyReviewAPI,
  transformDailyReview,
} from '@/types/dailyReview';

/**
 * Fetch daily review from API
 */
export async function getDailyReview(topN: number = 10): Promise<DailyReview> {
  const url = `${apiUrl(API_ENDPOINTS.dailyReview)}?top_n=${topN}`;
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
export function useDailyReview(topN: number = 10) {
  return useQuery({
    queryKey: ['dailyReview', topN],
    queryFn: () => getDailyReview(topN),
    staleTime: 1000 * 60 * 5, // 5 minutes - review data is relatively stable
    refetchOnWindowFocus: false, // Don't refetch on window focus - user is reviewing
  });
}
