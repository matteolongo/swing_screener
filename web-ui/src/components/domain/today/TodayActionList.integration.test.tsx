import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '@/lib/api';
import { t } from '@/i18n/t';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { useScreenerStore, type TodayRunSnapshot } from '@/stores/screenerStore';
import TodayActionList from './TodayActionList';

describe('TodayActionList source integration', () => {
  it('keeps independent sources visible and retries only the failed review source', async () => {
    const reviewRequests = vi.fn();
    const nearTriggerRequests = vi.fn();
    const positionsRequests = vi.fn();
    const watchlistRequests = vi.fn();
    server.use(
      http.get(`${API_BASE_URL}/api/daily-review`, ({ request }) => {
        if (new URL(request.url).searchParams.get('top_n') === '1') {
          nearTriggerRequests();
          return HttpResponse.json({
            watchlist_near_trigger: [{
              ticker: 'WATCHED', watched_at: '2026-09-11', source: 'manual', price_history: [],
            }],
            new_candidates: [], positions_add_on_candidates: [], positions_hold: [],
            positions_update_stop: [], positions_close: [],
            summary: {
              total_positions: 0, no_action: 0, update_stop: 0, close_positions: 0,
              new_candidates: 0, add_on_candidates: 0, review_date: '2026-09-11',
            },
          });
        }
        reviewRequests();
        return HttpResponse.json({ detail: 'review unavailable' }, { status: 503 });
      }),
      http.get(`${API_BASE_URL}/api/portfolio/positions`, () => {
        positionsRequests();
        return HttpResponse.json({ positions: [{
          position_id: 'POS-1', ticker: 'POSITION', status: 'open', entry_price: 90,
          stop_price: 85, shares: 1, current_price: 100, r_now: 1, entry_date: '2026-09-01',
        }] });
      }),
      http.get(`${API_BASE_URL}/api/watchlist`, () => {
        watchlistRequests();
        return HttpResponse.json({ items: [
          { ticker: 'WATCHED', watched_at: '2026-09-11', source: 'manual', price_history: [] },
          { ticker: 'FAR', watched_at: '2026-09-11', source: 'manual', price_history: [] },
        ] });
      }),
    );
    useScreenerStore.setState({
      todayRunInitialized: true,
      todayRun: {
        request: { preset: 'us_large_cap_equities' },
        displayFilters: { recommendedOnly: true, actionFilter: 'all' },
        completedAt: '2026-09-11T20:00:00Z',
        result: {
          asofDate: '2026-09-11', totalScreened: 1, dataFreshness: 'final_close',
          candidates: [{
            ticker: 'PINNED', currency: 'USD', close: 100, sma20: null, sma50: null, sma200: null,
            atr: 1, momentum6m: 0, momentum12m: 0, relStrength: 0, score: 1, confidence: 90, rank: 1, rr: 2,
            recommendation: { verdict: 'RECOMMENDED', workflowStatus: 'ready', nextStep: { code: 'review_order' } },
          }],
        },
      } as unknown as TodayRunSnapshot,
    });

    const { user } = renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    await waitFor(() => expect(screen.getByText('POSITION')).toBeInTheDocument());
    expect(screen.getByText('PINNED')).toBeInTheDocument();
    expect(screen.getByText('WATCHED')).toBeInTheDocument();
    expect(screen.queryByText('FAR')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('todayPage.actionList.retryReview') }));
    await waitFor(() => expect(reviewRequests).toHaveBeenCalledTimes(2));
    expect(positionsRequests).toHaveBeenCalledTimes(1);
    expect(nearTriggerRequests).toHaveBeenCalledTimes(1);
    expect(watchlistRequests).not.toHaveBeenCalled();
  });
});
