import { it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useScreener } from './useScreener';
import { useScreenerStore } from '../store/useScreenerStore';
import { useAppStore } from '../store/useAppStore';

const mockRunScreener = vi.fn();
const mockGetPoolPresets = vi.fn();

vi.mock('../services/api/screenerApi', () => ({
  runScreener: (...args: unknown[]) => mockRunScreener(...args),
  getPoolPresets: (...args: unknown[]) => mockGetPoolPresets(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useScreenerStore.setState({
    candidates: [],
    universe: 'us_sp500',
    preset: null,
    sortBy: 'score',
    isLoading: false,
    error: null,
  });
  useAppStore.setState({ activeTab: 'screener', mode: 'eod', alerts: [], accountSize: 50000 });
  mockGetPoolPresets.mockResolvedValue({ presets: [] });
});

it('fetches candidates on mount when candidates are empty', async () => {
  mockRunScreener.mockResolvedValue({
    candidates: [{ rank: 1, symbol: 'AAPL', exchange_mic: 'XNAS', setup: 'M', entry: 180, stop: 170, rr: 2.5, risk_usd: 500, shares: 50, sector: 'Tech', price: 182, close: 181 }],
    universe: 'SP500',
    generated_at: '2025-01-15T20:00:00Z',
    freshness: 'final_close',
  });

  renderHook(() => useScreener());

  await waitFor(() => {
    expect(useScreenerStore.getState().candidates).toHaveLength(1);
  });
});

it('sets loading state during fetch', async () => {
  mockRunScreener.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve({
      candidates: [],
      universe: 'SP500',
      generated_at: '2025-01-15T20:00:00Z',
      freshness: 'final_close',
    }), 100)),
  );

  renderHook(() => useScreener());

  await waitFor(() => {
    expect(useScreenerStore.getState().isLoading).toBe(true);
  });
});

it('sets error on failure', async () => {
  mockRunScreener.mockRejectedValue(new Error('Network error'));

  renderHook(() => useScreener());

  await waitFor(() => {
    expect(useScreenerStore.getState().error).toBe('Network error');
  });
});

it('refetch can be called manually', async () => {
  mockRunScreener.mockResolvedValue({
    candidates: [],
    universe: 'SP500',
    generated_at: '2025-01-15T20:00:00Z',
    freshness: 'final_close',
  });

  const { result } = renderHook(() => useScreener());

  await waitFor(() => {
    expect(mockRunScreener).toHaveBeenCalledTimes(1);
  });

  mockRunScreener.mockResolvedValue({
    candidates: [{ rank: 1, symbol: 'MSFT', exchange_mic: 'XNAS', setup: 'M', entry: 400, stop: 385, rr: 2.0, risk_usd: 750, shares: 20, sector: 'Tech', price: 405, close: 402 }],
    universe: 'SP500',
    generated_at: '2025-01-15T20:00:00Z',
    freshness: 'final_close',
  });

  await result.current.refetch();

  expect(useScreenerStore.getState().candidates).toHaveLength(1);
  expect(useScreenerStore.getState().candidates[0].symbol).toBe('MSFT');
});
