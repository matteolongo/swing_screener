import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { useStrategyEditor } from '@/features/strategy/useStrategyEditor';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useStrategyEditor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads strategies and initializes selection', async () => {
    const { result } = renderHook(() => useStrategyEditor(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.strategies.length).toBeGreaterThan(0);
      expect(result.current.selectedId).toBeTruthy();
      expect(result.current.draft).not.toBeNull();
    });
  });

  it('enables create flow when required fields are present', async () => {
    const { result } = renderHook(() => useStrategyEditor(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    act(() => {
      result.current.setCreateId('breakout_v3');
      result.current.setCreateName('Breakout v3');
    });

    await waitFor(() => {
      expect(result.current.idAlreadyExists).toBe(false);
      expect(result.current.canCreate).toBe(true);
    });
  });
});
