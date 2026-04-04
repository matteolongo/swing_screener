import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWeeklyReview, fetchWeeklyReviews, upsertWeeklyReview, WeeklyReviewUpsertRequest } from './api';

export function useWeeklyReviews() {
  return useQuery({
    queryKey: ['weekly-reviews'],
    queryFn: fetchWeeklyReviews,
    staleTime: 1000 * 60 * 5,
  });
}

export function useWeeklyReview(weekId: string | null | undefined) {
  return useQuery({
    queryKey: ['weekly-review', weekId ?? null],
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
      queryClient.invalidateQueries({ queryKey: ['weekly-review', weekId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-reviews'] });
    },
  });
}
