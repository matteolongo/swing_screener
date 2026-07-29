import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWatchlist } from './useWatchlist';
import { useWatchlistStore } from '../store/useWatchlistStore';

const mockAddWatchlistItem = vi.fn();
const mockRemoveWatchlistItem = vi.fn();
const mockGetWatchlist = vi.fn();
const mockRunScreener = vi.fn();

vi.mock('../services/api/watchlistApi', () => ({
  addWatchlistItem: (...args: unknown[]) => mockAddWatchlistItem(...args),
  removeWatchlistItem: (...args: unknown[]) => mockRemoveWatchlistItem(...args),
  getWatchlist: (...args: unknown[]) => mockGetWatchlist(...args),
}));

vi.mock('../services/api/screenerApi', () => ({
  runScreener: (...args: unknown[]) => mockRunScreener(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useWatchlistStore.setState({ items: [], isLoading: false, error: null });
  mockAddWatchlistItem.mockResolvedValue({ symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, sector: 'Tech' });
});

describe('useWatchlist', () => {
  it('returns items from store', () => {
    useWatchlistStore.setState({ items: [{ symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, sector: 'Tech' }] });
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].symbol).toBe('AAPL');
  });

  it('returns isLoading from store', () => {
    useWatchlistStore.setState({ isLoading: true });
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns error from store', () => {
    useWatchlistStore.setState({ error: 'Store error' });
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.error).toBe('Store error');
  });

  it('addWatchlistItem calls store addItem', async () => {
    const { result } = renderHook(() => useWatchlist());
    await result.current.addWatchlistItem('AAPL');
    await waitFor(() => {
      expect(useWatchlistStore.getState().items).toHaveLength(1);
    });
  });

  it('addWatchlistItem sets local error on failure', async () => {
    mockAddWatchlistItem.mockRejectedValue(new Error('Add failed'));
    const { result } = renderHook(() => useWatchlist());
    await result.current.addWatchlistItem('AAPL');
    await waitFor(() => {
      expect(result.current.error).toBe('Add failed');
    });
  });

  it('removeWatchlistItem calls store removeItem', async () => {
    useWatchlistStore.setState({ items: [{ symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, sector: 'Tech' }] });
    mockRemoveWatchlistItem.mockResolvedValue(undefined);
    const { result } = renderHook(() => useWatchlist());
    await result.current.removeWatchlistItem('AAPL');
    await waitFor(() => {
      expect(useWatchlistStore.getState().items).toHaveLength(0);
    });
  });

  it('runScreenerForSymbol calls screener API', async () => {
    mockRunScreener.mockResolvedValue({ candidates: [], universe: 'custom', generated_at: '', freshness: 'final_close' });
    const { result } = renderHook(() => useWatchlist());
    const res = await result.current.runScreenerForSymbol('AAPL');
    expect(mockRunScreener).toHaveBeenCalledWith({ index_memberships: ['AAPL'] });
    expect(res).not.toBeNull();
  });

  it('runScreenerOnWatchlist calls screener API with all symbols', async () => {
    useWatchlistStore.setState({ items: [{ symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, sector: 'Tech' }, { symbol: 'MSFT', exchange_mic: 'XNAS', price: 405, change_pct: -0.5, sector: 'Tech' }] });
    mockRunScreener.mockResolvedValue({ candidates: [], universe: 'custom', generated_at: '', freshness: 'final_close' });
    const { result } = renderHook(() => useWatchlist());
    const res = await result.current.runScreenerOnWatchlist();
    expect(mockRunScreener).toHaveBeenCalledWith({ index_memberships: ['AAPL', 'MSFT'] });
    expect(res).not.toBeNull();
  });

  it('runScreenerOnWatchlist returns null when watchlist empty', async () => {
    const { result } = renderHook(() => useWatchlist());
    const res = await result.current.runScreenerOnWatchlist();
    expect(res).toBeNull();
    expect(mockRunScreener).not.toHaveBeenCalled();
  });
});
