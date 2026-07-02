import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { messagesEn } from '@/i18n/messages.en';
import { useScreenerStore } from '@/stores/screenerStore';
import type { ScreenerResponse } from '@/features/screener/types';
import StatusBar from './StatusBar';

describe('StatusBar', () => {
  afterEach(() => {
    useScreenerStore.getState().clearLastResult();
  });

  it('shows the active strategy chip linking to /system/strategy', async () => {
    renderWithProviders(<StatusBar />);
    const chip = await screen.findByRole('link', { name: /Default/ });
    expect(chip).toHaveAttribute('href', '/system/strategy');
  });

  it('shows the equity value from the portfolio summary', async () => {
    renderWithProviders(<StatusBar />);
    // mockPortfolioSummary.effective_account_size = 625 → formatCurrency → $625.00
    expect(await screen.findByText('$625.00')).toBeInTheDocument();
  });

  it('toggles the sidebar', () => {
    const onToggle = vi.fn();
    renderWithProviders(<StatusBar onToggleSidebar={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(messagesEn.header.hideNavigation) }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('hides the review-queue badge when the queue is empty', async () => {
    renderWithProviders(<StatusBar />);
    await screen.findByRole('link', { name: /Default/ });
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
    const { user } = renderWithProviders(<StatusBar />);
    const badge = await screen.findByRole('button', {
      name: messagesEn.reviewQueue.badgeLabel,
    });
    expect(badge).toHaveTextContent('2');
    await user.click(badge);
    expect(screen.getByText(messagesEn.reviewQueue.title)).toBeInTheDocument();
  });

  it('shows a freshness badge when the screener store has a last result', async () => {
    const mockResult: ScreenerResponse = {
      candidates: [],
      asofDate: '2026-07-01',
      totalScreened: 0,
      dataFreshness: 'final_close',
    };
    useScreenerStore.getState().setLastResult(mockResult);

    renderWithProviders(<StatusBar />);
    expect(await screen.findByText(new RegExp(messagesEn.badges.freshness.finalClose))).toBeInTheDocument();
  });

  it('hides the freshness badge when the screener store has no last result', async () => {
    renderWithProviders(<StatusBar />);
    await screen.findByRole('link', { name: /Default/ });
    expect(screen.queryByText(new RegExp(messagesEn.badges.freshness.finalClose))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(messagesEn.badges.freshness.intraday))).not.toBeInTheDocument();
  });
});
