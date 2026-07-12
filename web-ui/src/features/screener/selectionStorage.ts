import type { TaxonomyFilterValues } from '@/features/pool/types';
import type { DailyReviewSelection } from '@/features/dailyReview/api';

// localStorage keys written by ScreenerInboxPanel via useLocalStorage (which
// JSON-encodes values). A pinned Today source stores its own complete request
// snapshot; it must not read mutable form preferences from these keys.
export const SCREENER_TAXONOMY_FILTER_KEY = 'screener.taxonomyFilter';
export const SCREENER_PRESET_ID_KEY = 'screener.presetId';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Read the screener's persisted taxonomy selection (preset + filter). */
export function readScreenerSelection(): DailyReviewSelection {
  const presetId = readJson<string | null>(SCREENER_PRESET_ID_KEY);
  const taxonomyFilter = readJson<TaxonomyFilterValues>(SCREENER_TAXONOMY_FILTER_KEY);
  return {
    presetId: typeof presetId === 'string' ? presetId : null,
    taxonomyFilter: taxonomyFilter && typeof taxonomyFilter === 'object' ? taxonomyFilter : null,
  };
}
