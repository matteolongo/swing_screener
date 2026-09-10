import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { I18nProvider } from '@/i18n/I18nProvider';
import { API_BASE_URL } from '@/lib/api';
import { t } from '@/i18n/t';
import { mockPortfolioSummary } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import Book from './Book';

function renderBookWithRouteState(state: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[{ pathname: '/book', state }]}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/book" element={<Book />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('Book page route state', () => {
  it('opens the review tab when navigation state requests review', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/weekly-reviews/:weekId`, () =>
        HttpResponse.json({ review: null }),
      ),
      http.get(`${API_BASE_URL}/api/weekly-reviews`, () =>
        HttpResponse.json([]),
      ),
    );

    renderBookWithRouteState({ tab: 'review' });

    const reviewTab = await screen.findByRole('button', {
      name: t('bookPage.tabs.review'),
    });

    expect(reviewTab).toHaveClass('bg-primary/10');
  });

  it('renders the canonical partial-close R in the journal instead of recomputing it', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/portfolio/positions`, () => HttpResponse.json({
        asof: '2026-01-03',
        positions: [{
          ticker: 'PART', status: 'closed', entry_date: '2026-01-01', entry_price: 100,
          stop_price: 90, shares: 1, position_id: null, initial_risk: 10,
          max_favorable_price: 130, exit_date: '2026-01-03', exit_price: 120,
          current_price: null, notes: '', exit_order_ids: [], tags: ['breakout'],
          partial_closes: [{ date: '2026-01-02', shares_closed: 1, price: 110, r_at_close: 1 }],
          pnl: 20, pnl_percent: 20, r_now: 0, entry_value: 100, current_value: 120,
          per_share_risk: 10, total_risk: 10, fees_eur: 0,
        }],
      })),
      http.get(`${API_BASE_URL}/api/portfolio/summary`, () => HttpResponse.json({
        ...mockPortfolioSummary,
        analytics: {
          closed_trade_count: 1, excluded_trade_count: 0, win_count: 1, loss_count: 0, scratch_count: 0,
          win_rate: 100, win_rate_status: 'positive', average_r: 1.5, average_max_r: 3, profit_factor: null, profit_factor_status: 'neutral',
          average_holding_days: 2, max_win_streak: 1, max_loss_streak: 0,
          equity_curve: [{ position_id: 'analytics-partial', ticker: 'PART', date: '2026-01-03', r: 1.5, max_r: 3, holding_days: 2, cumulative_r: 1.5, tags: ['breakout'], entry_price: 100, exit_price: 120, shares: 1, initial_risk: 10, thesis: null, notes: '', lesson: null }],
          tag_breakdown: [],
          journal_tag_breakdown: [{ tag: 'breakout', trade_count: 1, win_count: 1, loss_count: 0, scratch_count: 0, average_r: 1.5, average_max_r: 3 }],
          insight: { verdict: 'positive', reason: 'positive_edge' },
        },
      })),
    );

    renderBookWithRouteState({ tab: 'journal' });

    expect(await screen.findByText('+1.50R')).toBeInTheDocument();
    expect(screen.getByText('+3.00R')).toBeInTheDocument();
  });
});
