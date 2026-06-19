import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/fundamentals/api', () => ({
  fetchFundamentalSnapshot: vi.fn(),
}));

import * as fundamentalsApi from '@/features/fundamentals/api';
import { useFundamentalSnapshotQuery, useRefreshFundamentalSnapshotMutation } from '@/features/fundamentals/hooks';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("fundamentals hooks", () => {
  const mockedFetchFundamentalSnapshot = vi.mocked(fundamentalsApi.fetchFundamentalSnapshot);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSnapshot = {
    symbol: "AAPL",
    asofDate: "2026-03-18",
    provider: "yfinance",
    updatedAt: "2026-03-18T10:00:00",
    instrumentType: "equity",
    supported: true,
    coverageStatus: "supported" as const,
    freshnessStatus: "current" as const,
    pillars: {},
    historicalSeries: {},
    metricContext: {},
    dataQualityStatus: "medium" as const,
    dataQualityFlags: [],
    redFlags: [],
    highlights: [],
    metricSources: {},
  };

  it("fetches snapshot for a symbol", async () => {
    const queryClient = createQueryClient();
    mockedFetchFundamentalSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useFundamentalSnapshotQuery("AAPL"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetchFundamentalSnapshot).toHaveBeenCalledWith("AAPL", false);
    expect(result.current.data?.symbol).toBe("AAPL");
  });

  it("does not fetch when symbol is missing", async () => {
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useFundamentalSnapshotQuery(undefined), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mockedFetchFundamentalSnapshot).not.toHaveBeenCalled();
  });

  it("refresh mutation invalidates snapshot cache", async () => {
    const queryClient = createQueryClient();
    mockedFetchFundamentalSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useRefreshFundamentalSnapshotMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("AAPL");
    });

    expect(mockedFetchFundamentalSnapshot).toHaveBeenCalledWith("AAPL", true);
  });
});
