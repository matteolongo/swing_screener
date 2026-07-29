import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWatchlistStore } from './useWatchlistStore';
import type { WatchlistItem } from '../types/api';

const mockItems: WatchlistItem[] = [
  { symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, sector: 'Tech', held: 10 },
];

beforeEach(() => {
  useWatchlistStore.setState({ items: [], isLoading: false, error: null });
  vi.restoreAllMocks();
});

describe('useWatchlistStore', () => {
  it('sets items', () => {
    useWatchlistStore.getState().setItems(mockItems);
    expect(useWatchlistStore.getState().items).toHaveLength(1);
  });

  it('setItems replaces items', () => {
    useWatchlistStore.getState().setItems(mockItems);
    useWatchlistStore.getState().setItems([]);
    expect(useWatchlistStore.getState().items).toHaveLength(0);
  });

  it('sets loading', () => {
    useWatchlistStore.getState().setLoading(true);
    expect(useWatchlistStore.getState().isLoading).toBe(true);
  });

  it('sets error', () => {
    useWatchlistStore.getState().setError('fail');
    expect(useWatchlistStore.getState().error).toBe('fail');
  });
});
