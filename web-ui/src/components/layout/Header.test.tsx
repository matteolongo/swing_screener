import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { messagesEn } from '@/i18n/messages.en';
import { AuthProvider } from '@/features/auth/AuthProvider';
import Header from './Header';

describe('Header', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_BASE_URL}/api/auth/session`, () =>
        HttpResponse.json({
          authenticated: true,
          role: 'viewer',
          csrf_token: 'csrf',
          user: { subject: 'test-user', name: 'Test User', email: 'test@example.com' },
        }),
      ),
    );
  });

  const renderHeader = () => renderWithProviders(
    <AuthProvider>
      <Header />
    </AuthProvider>,
  );

  it('shows the compact risk summary', async () => {
    renderHeader();

    await screen.findByRole('combobox', { name: 'Active Strategy' });
    expect(await screen.findByText(/Risk \/ trade/)).toBeInTheDocument();
  });

  it('hides the review-queue badge when the queue is empty', async () => {
    renderHeader();
    await screen.findByRole('combobox', { name: 'Active Strategy' });
    expect(
      screen.queryByRole('button', { name: messagesEn.reviewQueue.badgeLabel })
    ).not.toBeInTheDocument();
  });

  it('shows the review-queue badge with count and opens the drawer', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/pool/review-queue`, () =>
        HttpResponse.json({
          entries: [
            { symbol: 'AAPL', fetch_failure_count: 3, first_failed_at: '2026-06-28', last_failed_at: '2026-06-30', reason: 'no data' },
            { symbol: 'MSFT', fetch_failure_count: 3, first_failed_at: '2026-06-28', last_failed_at: '2026-06-30', reason: 'no data' },
          ],
        }),
      ),
    );
    const { user } = renderHeader();
    const badge = await screen.findByRole('button', {
      name: messagesEn.reviewQueue.badgeLabel,
    });
    expect(badge).toHaveTextContent('2');
    await user.click(badge);
    expect(screen.getByText(messagesEn.reviewQueue.title)).toBeInTheDocument();
  });
});
