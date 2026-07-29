import { useCallback, useState } from 'react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { runScreener } from '@/services/api/screenerApi';
import type { TaxonomyFilter } from '@/types/api';

export function useWatchlist() {
  const {
    items, isLoading, error: storeError,
    addItem, removeItem, refresh,
  } = useWatchlistStore();
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError || storeError;

  const fetchWatchlist = useCallback(async () => {
    setLocalError(null);
    try {
      await refresh();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to load watchlist');
    }
  }, [refresh]);

  const addWatchlistItem = useCallback(async (ticker: string) => {
    setLocalError(null);
    try {
      await addItem(ticker);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to add symbol');
    }
  }, [addItem]);

  const removeWatchlistItem = useCallback(async (ticker: string) => {
    setLocalError(null);
    try {
      await removeItem(ticker);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to remove symbol');
    }
  }, [removeItem]);

  const runScreenerForSymbol = useCallback(async (ticker: string) => {
    setLocalError(null);
    try {
      const filter: TaxonomyFilter = { index_memberships: [ticker] };
      return await runScreener(filter);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to run screener');
      return null;
    }
  }, []);

  const runScreenerOnWatchlist = useCallback(async () => {
    if (items.length === 0) return null;
    setLocalError(null);
    try {
      const tickers = items.map((i) => i.symbol);
      const filter: TaxonomyFilter = { index_memberships: tickers };
      return await runScreener(filter);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to run screener');
      return null;
    }
  }, [items]);

  return {
    items, isLoading, error,
    fetchWatchlist, addWatchlistItem, removeWatchlistItem,
    runScreenerForSymbol, runScreenerOnWatchlist,
  };
}
