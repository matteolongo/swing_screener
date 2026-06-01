import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

it('useDegiroStatusQuery returns status from MSW', async () => {
  const { result } = renderHook(() => useDegiroStatusQuery(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  // The default MSW handler returns available: false (library not installed)
  expect(result.current.data?.available).toBe(false);
});
