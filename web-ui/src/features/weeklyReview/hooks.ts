import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWeeklyReview, fetchWeeklyReviews, upsertWeeklyReview, WeeklyReviewUpsertRequest } from './api';
import { queryKeys } from '@/lib/queryKeys';

export function useWeeklyReviews() {
  return useQuery({
    queryKey: queryKeys.weeklyReviews(),
    queryFn: fetchWeeklyReviews,
    staleTime: 1000 * 60 * 5,
  });
}

export function useWeeklyReview(weekId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.weeklyReview(weekId),
    queryFn: () => fetchWeeklyReview(weekId as string),
    enabled: !!weekId,
    retry: (failureCount, error: unknown) => {
      if (error && typeof error === 'object' && 'response' in error) {
        const e = error as { response?: { status?: number } };
        if (e.response?.status === 404) return false;
      }
      return failureCount < 2;
    },
  });
}

export function useUpsertWeeklyReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ weekId, request }: { weekId: string; request: WeeklyReviewUpsertRequest }) =>
      upsertWeeklyReview(weekId, request),
    onSuccess: (_, { weekId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weeklyReview(weekId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weeklyReviews() });
    },
  });
}
