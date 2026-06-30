import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders, screen } from '@/test/utils';
import { API_BASE_URL } from '@/lib/api';
import { messagesEn } from '@/i18n/messages.en';
import ReviewQueueDrawer from './ReviewQueueDrawer';

const rq = messagesEn.reviewQueue;

function seedQueue(entries: unknown[]) {
  server.use(
    http.get(`${API_BASE_URL}/api/pool/review-queue`, () =>
      HttpResponse.json({ entries }),
    ),
  );
}

describe('ReviewQueueDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <ReviewQueueDrawer open={false} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists queued symbols when open', async () => {
    seedQueue([
      {
        symbol: 'AAPL',
        exchange_mic: 'XNAS',
        fetch_failure_count: 3,
        first_failed_at: '2026-06-28',
        last_failed_at: '2026-06-30',
        reason: 'OHLCV fetch returned no data',
      },
    ]);
    renderWithProviders(<ReviewQueueDrawer open onClose={() => {}} />);
    expect(screen.getByText(rq.title)).toBeInTheDocument();
    expect(await screen.findByText('AAPL')).toBeInTheDocument();
  });

  it('shows the empty state when the queue is empty', async () => {
    seedQueue([]);
    renderWithProviders(<ReviewQueueDrawer open onClose={() => {}} />);
    expect(await screen.findByText(rq.empty)).toBeInTheDocument();
  });

  it('calls restore when Keep is clicked', async () => {
    const restore = vi.fn(() => HttpResponse.json({ restored: true }));
    seedQueue([
      {
        symbol: 'AAPL',
        fetch_failure_count: 3,
        first_failed_at: '2026-06-28',
        last_failed_at: '2026-06-30',
        reason: 'no data',
      },
    ]);
    server.use(http.post(`${API_BASE_URL}/api/pool/review-queue/AAPL/restore`, restore));
    const { user } = renderWithProviders(<ReviewQueueDrawer open onClose={() => {}} />);
    await screen.findByText('AAPL');
    await user.click(screen.getByRole('button', { name: rq.actions.keep }));
    expect(restore).toHaveBeenCalled();
  });
});
