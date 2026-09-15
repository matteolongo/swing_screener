import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '@/lib/api';
import { server } from '@/test/mocks/server';
import { usePortfolioReview } from '@/features/dailyReview/api';
import { useFillOrderMutation } from './hooks';

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('order lifecycle cache integration', () => {
  it('refetches the active Daily Review after an MSW-backed fill mutation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const reviewRequests = vi.fn();
    server.use(
      http.get(`${API_BASE_URL}/api/daily-review`, () => {
        reviewRequests();
        return HttpResponse.json({
          watchlist_near_trigger: [], new_candidates: [], positions_add_on_candidates: [],
          positions_hold: [], positions_update_stop: [], positions_close: [],
          summary: {
            total_positions: 0, no_action: 0, update_stop: 0, close_positions: 0,
            new_candidates: 0, add_on_candidates: 0, review_date: '2026-09-11',
          },
        });
      }),
      http.post(`${API_BASE_URL}/api/portfolio/orders/:orderId/fill`, () =>
        HttpResponse.json({ status: 'ok' }),
      ),
    );

    const { result } = renderHook(() => ({
      review: usePortfolioReview(),
      fill: useFillOrderMutation(),
    }), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.review.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fill.mutateAsync({
        orderId: 'ORD-1',
        request: { filledPrice: 100, filledDate: '2026-09-11' },
      });
    });
    await waitFor(() => expect(reviewRequests).toHaveBeenCalledTimes(2));
  });
});
