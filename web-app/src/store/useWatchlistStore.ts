import { create } from 'zustand';
import type { WatchlistItem } from '../types/api';
import {
  getWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
} from '../services/api/watchlistApi';

interface WatchlistState {
  items: WatchlistItem[];
  isLoading: boolean;
  error: string | null;

  setItems: (list: WatchlistItem[]) => void;
  addItem: (ticker: string) => Promise<void>;
  removeItem: (ticker: string) => Promise<void>;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  refresh: () => Promise<void>;
}

export const useWatchlistStore = create<WatchlistState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  setItems: (list) => set({ items: list }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),

  addItem: async (ticker) => {
    try {
      set({ isLoading: true, error: null });
      const item = await addWatchlistItem(ticker);
      set((s) => ({ items: [...s.items, item], isLoading: false }));
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message || 'Failed to add item' });
    }
  },

  removeItem: async (ticker) => {
    try {
      set({ isLoading: true, error: null });
      await removeWatchlistItem(ticker);
      set((s) => ({ items: s.items.filter((i) => i.symbol !== ticker), isLoading: false }));
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message || 'Failed to remove item' });
    }
  },

  refresh: async () => {
    try {
      set({ isLoading: true, error: null });
      const items = await getWatchlist();
      set({ items, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message || 'Failed to fetch watchlist' });
    }
  },
}));
