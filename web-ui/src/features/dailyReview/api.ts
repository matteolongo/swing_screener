/**
 * Daily Review API client and React Query hooks
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import { queryKeys } from '@/lib/queryKeys';
import {
  DailyReview,
  DailyReviewAPI,
  transformDailyReview,
} from '@/features/dailyReview/types';

/**
 * Fetch daily review from API
 */
export async function getDailyReview(
  topN: number = 200,
): Promise<DailyReview> {
  // Today deliberately requests a portfolio-only review. Discovery candidates
  // come from the pinned screener snapshot in the client, not from a second
  // backend screener run with a potentially different filter set.
  const params = new URLSearchParams();
  params.set('top_n', String(topN));
  params.set('include_candidates', 'false');
  const data = await fetchJson<DailyReviewAPI>(
    `${API_ENDPOINTS.dailyReview}?${params.toString()}`,
    { errorMessage: 'Failed to fetch daily review' },
  );
  return transformDailyReview(data);
}

/** Portfolio/watchlist review with no implicit candidate-discovery run. */
export function usePortfolioReview() {
  return useQuery({
    queryKey: queryKeys.dailyReview(0, 'portfolio'),
    queryFn: () => getDailyReview(200),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export async function refetchTodayPortfolio(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    [queryKeys.dailyReviewPrefix(), queryKeys.positions(), queryKeys.orders(), queryKeys.portfolioSummary()]
      .map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'active' })),
  );
}
