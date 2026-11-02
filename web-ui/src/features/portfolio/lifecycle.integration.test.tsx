import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '@/lib/api';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import ManagePositionPanel from '@/components/domain/workspace/ManagePositionPanel';
import PositionProtectionNotice from '@/components/domain/orders/PositionProtectionNotice';
import { usePortfolioReview } from '@/features/dailyReview/api';
import { useFillOrderMutation, usePartialClosePositionMutation } from './hooks';

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('order lifecycle cache integration', () => {
  it('reports protection cancelled by a recorded target fill', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    server.use(http.post(`${API_BASE_URL}/api/portfolio/orders/:orderId/fill`, () =>
      HttpResponse.json({ order_id: 'TARGET-1', position: { status: 'closed' }, linked_order_ids: ['STOP-1'] })));
    const { result } = renderHook(() => useFillOrderMutation(), { wrapper: createWrapper(queryClient) });
    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({ orderId: 'TARGET-1', request: { filledPrice: 110, filledDate: '2026-10-14' } });
    });
    expect(response).toMatchObject({ linkedOrderIds: ['STOP-1'], protectionAction: 'cancellation' });
  });

  it('keeps the broker cancellation reminder when the closed position panel unmounts during refresh', async () => {
    let removeClosedPanel = () => {};
    function PositionWorkspace() {
      const [visible, setVisible] = useState(true);
      removeClosedPanel = () => setVisible(false);
      return <>
        <PositionProtectionNotice />
        {visible ? <ManagePositionPanel position={{
          positionId: 'POS-1', ticker: 'AAPL', status: 'open', entryDate: '2026-10-13',
          entryPrice: 100, stopPrice: 95, shares: 5, pnl: 0, pnlPercent: 0, rNow: 0,
          entryValue: 500, currentValue: 500, perShareRisk: 5, totalRisk: 25,
          feesEur: 0, daysOpen: 1, timeStopWarning: false, priceSource: 'live', rUsesInitialRisk: true,
        }} /> : null}
      </>;
    }
    server.use(http.post(`${API_BASE_URL}/api/portfolio/positions/:positionId/close`, () => {
      removeClosedPanel();
      return HttpResponse.json({ status: 'ok', linked_order_ids: ['ORD-STOP-POS-1'] });
    }));
    const { user } = renderWithProviders(<PositionWorkspace />);
    await user.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.exit') }));
    fireEvent.submit(screen.getByLabelText(t('positions.closeModal.exitPrice')).closest('form')!);

    expect(await screen.findByRole('status')).toHaveTextContent(t('orders.protection.manualCancellation'));
    expect(screen.queryByText(t('workspacePage.panels.analysis.managePosition.title'))).not.toBeInTheDocument();
  });

  it('returns linked local protection after a partial close', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    server.use(
      http.post(`${API_BASE_URL}/api/portfolio/positions/:positionId/partial-close`, () =>
        HttpResponse.json({
          status: 'ok',
          position_id: 'POS-1',
          linked_order_ids: ['ORD-STOP-POS-1'],
        }),
      ),
    );

    const { result } = renderHook(() => usePartialClosePositionMutation(), {
      wrapper: createWrapper(queryClient),
    });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
        positionId: 'POS-1',
        request: { sharesClosed: 5, price: 110 },
      });
    });

    expect(response).toEqual({ linkedOrderIds: ['ORD-STOP-POS-1'] });
  });

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
