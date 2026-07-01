/**
 * Daily Review API client and React Query hooks
 */
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import { queryKeys } from '@/lib/queryKeys';
import { toTaxonomyFilterPayload, type TaxonomyFilterValues } from '@/features/pool/types';
import {
  DailyReview,
  DailyReviewAPI,
  transformDailyReview,
} from '@/features/dailyReview/types';

/**
 * Daily-review selection mirroring the screener's taxonomy filter / preset.
 */
export interface DailyReviewSelection {
  presetId?: string | null;
  taxonomyFilter?: TaxonomyFilterValues | null;
}

function hasTaxonomyValues(filter?: TaxonomyFilterValues | null): boolean {
  return Boolean(filter && Object.values(filter).some((v) => v && v.length));
}

/** Stable cache-key fragment for a daily-review selection. */
export function dailyReviewSelectionKey(selection?: DailyReviewSelection): string {
  if (!selection) return '';
  const preset = selection.presetId ?? '';
  const filter = hasTaxonomyValues(selection.taxonomyFilter)
    ? JSON.stringify(selection.taxonomyFilter)
    : '';
  return `${preset}|${filter}`;
}

/**
 * Fetch daily review from API
 */
export async function getDailyReview(
  topN: number = 200,
  selection?: DailyReviewSelection,
): Promise<DailyReview> {
  const preset = selection?.presetId?.trim() || null;
  const taxonomyFilter = hasTaxonomyValues(selection?.taxonomyFilter)
    ? selection!.taxonomyFilter!
    : null;

  const params = new URLSearchParams();
  params.set('top_n', String(topN));
  if (preset) {
    params.set('preset', preset);
  }
  if (taxonomyFilter) {
    params.set('taxonomy_filter', JSON.stringify(toTaxonomyFilterPayload(taxonomyFilter)));
  }
  const data = await fetchJson<DailyReviewAPI>(
    `${API_ENDPOINTS.dailyReview}?${params.toString()}`,
    { errorMessage: 'Failed to fetch daily review' },
  );
  return transformDailyReview(data);
}

/**
 * React Query hook for daily review
 */
export function useDailyReview(topN: number = 200, selection?: DailyReviewSelection) {
  return useQuery({
    queryKey: queryKeys.dailyReview(topN, dailyReviewSelectionKey(selection)),
    queryFn: () => getDailyReview(topN, selection),
    staleTime: 1000 * 60 * 5, // 5 minutes - review data is relatively stable
    refetchOnWindowFocus: false, // Don't refetch on window focus - user is reviewing
  });
}
