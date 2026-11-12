import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '@/lib/api';
import { t } from '@/i18n/t';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import TodayActionList from './TodayActionList';

const position = {
  position_id: 'POS-1', ticker: 'POSITION', status: 'open', entry_price: 90,
  stop_price: 85, shares: 1, current_price: 100, r_now: 1, entry_date: '2026-09-01',
};

const review = {
  watchlist_near_trigger: [{
    ticker: 'WATCHED', watched_at: '2026-09-11', source: 'manual', price_history: [],
  }],
  new_candidates: [], positions_add_on_candidates: [], positions_hold: [],
  positions_update_stop: [], positions_close: [],
  summary: {
    total_positions: 1, no_action: 0, update_stop: 0, close_positions: 0,
    new_candidates: 0, add_on_candidates: 0, review_date: '2026-09-11',
  },
};

describe('TodayActionList source integration', () => {
  it('retains the loaded review when portfolio refresh fails and lets the user retry', async () => {
    let fail = false;
    const reviewRequests = vi.fn();
    server.use(
      http.get('*/api/daily-review', () => {
        reviewRequests();
        return fail
          ? HttpResponse.json({ detail: 'Review temporarily unavailable.' }, { status: 503 })
          : HttpResponse.json(review);
      }),
      http.get('*/api/portfolio/positions', () => HttpResponse.json({ positions: [position] })),
    );
    const { user } = renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    expect(await screen.findByRole('button', { name: /WATCHED/ })).toBeVisible();
    fail = true;

    await user.click(screen.getByRole('button', { name: t('dailyReview.header.refreshTitle') }));
    expect(await screen.findByText(t('dailyReview.header.error', {
      message: 'Review temporarily unavailable.',
    }))).toBeVisible();
    expect(screen.getByRole('button', { name: /WATCHED/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /POSITION/ })).toBeVisible();

    fail = false;
    await user.click(screen.getByRole('button', { name: t('todayPage.actionList.retryReview') }));
    await waitFor(() => expect(screen.queryByText(t('dailyReview.header.error', {
      message: 'Review temporarily unavailable.',
    }))).not.toBeInTheDocument());
    expect(reviewRequests).toHaveBeenCalledTimes(3);
  });

  it('loads watchlist attention in the portfolio review and retries a partial failure', async () => {
    const positionsRequests = vi.fn();
    const reviewRequests = vi.fn();
    const evaluationError = {
      symbol: 'POSITION', code: 'position_evaluation_failed', message: 'No eligible candles.',
    };
    server.use(
      http.get('*/api/daily-review', ({ request }) => {
        reviewRequests(new URL(request.url).searchParams.get('include_candidates'));
        return HttpResponse.json({
          ...review,
          evaluation_errors: reviewRequests.mock.calls.length === 1 ? [evaluationError] : [],
        });
      }),
      http.get('*/api/portfolio/positions', () => {
        positionsRequests();
        return HttpResponse.json({ positions: [position] });
      }),
    );
    const { user } = renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);

    expect(await screen.findByRole('button', { name: /POSITION/ })).toBeVisible();
    expect(await screen.findByRole('button', { name: /WATCHED/ })).toBeVisible();
    expect(screen.getByText(t('todayPage.actionList.evaluationFailed', evaluationError))).toBeVisible();
    expect(reviewRequests).toHaveBeenCalledTimes(1);
    expect(reviewRequests).toHaveBeenCalledWith('false');

    await user.click(screen.getByRole('button', { name: t('todayPage.actionList.retryReview') }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(reviewRequests).toHaveBeenCalledTimes(2);
    expect(positionsRequests).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected stop on its row and permits a later, higher suggestion', async () => {
    const stopRequests = vi.fn();
    let suggestedStop = 93;
    let positionStop = 85;
    const reason = 'Position changed since review.';
    server.use(
      http.get('*/api/daily-review', () => HttpResponse.json({
        ...review,
        positions_update_stop: [{
          ...position, stop_current: positionStop, stop_suggested: suggestedStop, reason: 'Trail stop.',
        }],
      })),
      http.get('*/api/portfolio/positions', () => HttpResponse.json({
        positions: [{ ...position, stop_price: positionStop }],
      })),
      http.put(API_BASE_URL + '/api/portfolio/positions/POS-1/stop', async ({ request }) => {
        stopRequests(await request.json());
        if (stopRequests.mock.calls.length === 1) {
          return HttpResponse.json({ detail: reason }, { status: 409 });
        }
        positionStop = suggestedStop;
        suggestedStop = 95;
        return HttpResponse.json({ position: { ...position, stop_price: positionStop } });
      }),
    );
    const { user } = renderWithProviders(<TodayActionList onTickerSelect={() => {}} />);
    const acceptName = t('todayPage.actionList.acceptStop');
    await user.click(await screen.findByRole('button', { name: acceptName }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(t('todayPage.actionList.acceptStopFailed', { message: reason }));
    await user.click(within(error).getByRole('button', { name: t('todayPage.actionList.refreshPortfolio') }));
    await waitFor(() => expect(screen.getByRole('button', { name: acceptName })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: acceptName }));

    await waitFor(() => expect(stopRequests).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: acceptName })).toBeEnabled());
    expect(screen.queryByText(t('todayPage.actionList.acceptStopDone'))).not.toBeInTheDocument();
    expect(stopRequests.mock.calls.map(([body]) => body.new_stop)).toEqual([93, 93]);
  });
});
