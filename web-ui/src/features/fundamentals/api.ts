import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
  FundamentalSnapshot,
  FundamentalSnapshotAPI,
  transformFundamentalSnapshot,
} from '@/features/fundamentals/types';

export async function fetchFundamentalSnapshot(
  symbol: string,
  refresh: boolean = false
): Promise<FundamentalSnapshot> {
  const endpoint = refresh
    ? `${API_ENDPOINTS.fundamentalsSnapshot(symbol)}?refresh=true`
    : API_ENDPOINTS.fundamentalsSnapshot(symbol);
  const payload = await fetchJson<FundamentalSnapshotAPI>(endpoint, {
    errorMessage: `Failed to fetch fundamentals for ${symbol}`,
  });
  return transformFundamentalSnapshot(payload);
}
