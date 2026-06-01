import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { useDegiroStatusQuery } from '@/features/portfolio/hooks';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('DeGiro portfolio hooks', () => {
  it('useDegiroStatusQuery returns unavailable status from MSW by default', async () => {
    const { result } = renderHook(() => useDegiroStatusQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.available).toBe(false);
    expect(result.current.data?.mode).toBe('missing_library');
  });
});
