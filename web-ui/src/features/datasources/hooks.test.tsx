import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/datasources/api', () => ({
  fetchDataSources: vi.fn(),
  probeSource: vi.fn(),
  probeAll: vi.fn(),
  fetchFallbackEvents: vi.fn(),
}));

import * as api from '@/features/datasources/api';
import { queryKeys } from '@/lib/queryKeys';
import { useProbeSourceMutation } from '@/features/datasources/hooks';

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

describe('datasources hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('probe mutation invalidates inventory', async () => {
    const queryClient = createQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(api.probeSource).mockResolvedValue({ id: 'yfinance', status: 'ok' });

    const { result } = renderHook(() => useProbeSourceMutation(), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => { await result.current.mutateAsync('yfinance'); });

    expect(api.probeSource).toHaveBeenCalledWith('yfinance');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.datasources() });
  });
});
