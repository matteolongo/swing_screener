import { it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDailyReview } from './useDailyReview';

const mockGetDailyReview = vi.fn();

vi.mock('../services/api/portfolioApi', () => ({
  getDailyReview: (...args: unknown[]) => mockGetDailyReview(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockData = {
  kpis: [{ label: 'Open Positions', value: 3, detail: '2 long, 1 short' }],
  positions: [],
  candidates: [],
  alerts: [],
  steps: [{ name: 'Screen', status: 'done' as const }],
};

it('fetches daily review on mount', async () => {
  mockGetDailyReview.mockResolvedValue(mockData);

  renderHook(() => useDailyReview());

  await waitFor(() => {
    expect(mockGetDailyReview).toHaveBeenCalledTimes(1);
  });
});

it('returns data after successful fetch', async () => {
  mockGetDailyReview.mockResolvedValue(mockData);

  const { result } = renderHook(() => useDailyReview());

  await waitFor(() => {
    expect(result.current.kpis).toHaveLength(1);
    expect(result.current.kpis[0].label).toBe('Open Positions');
    expect(result.current.steps[0].status).toBe('done');
  });
});

it('sets loading state during fetch', async () => {
  mockGetDailyReview.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(mockData), 50)),
  );

  const { result } = renderHook(() => useDailyReview());

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
});

it('sets error on failure', async () => {
  mockGetDailyReview.mockRejectedValue(new Error('Network error'));

  const { result } = renderHook(() => useDailyReview());

  await waitFor(() => {
    expect(result.current.error).toBe('Network error');
  });
});

it('returns empty arrays when data is null', () => {
  mockGetDailyReview.mockResolvedValue(mockData);

  const { result } = renderHook(() => useDailyReview());

  expect(result.current.kpis).toEqual([]);
  expect(result.current.positions).toEqual([]);
  expect(result.current.candidates).toEqual([]);
  expect(result.current.alerts).toEqual([]);
  expect(result.current.steps).toEqual([]);
});
