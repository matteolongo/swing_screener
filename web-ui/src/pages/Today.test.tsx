import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import Today from './Today';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useScreenerStore } from '@/stores/screenerStore';

function makeCloseItem(ticker: string, positionId: string) {
  return {
    position_id: positionId,
    ticker,
    entry_price: 100,
    stop_price: 90,
    current_price: 88,
    r_now: -1.2,
    days_open: 3,
    time_stop_warning: false,
    reason: 'Below stop',
  };
}

const threeCloseItemReview = {
  watchlist_near_trigger: [],
  positions_add_on_candidates: [],
  positions_hold: [],
  positions_update_stop: [],
  new_candidates: [],
  positions_close: [
    makeCloseItem('AMAT', 'pos-amat'),
    makeCloseItem('NVDA', 'pos-nvda'),
    makeCloseItem('MSFT', 'pos-msft'),
  ],
  summary: {
    total_positions: 3,
    no_action: 0,
    update_stop: 0,
    close_positions: 3,
    new_candidates: 0,
    add_on_candidates: 0,
    watchlist_near_trigger: 0,
    review_date: '2026-05-16',
  },
};

beforeEach(() => {
  useWorkspaceStore.setState({
    selectedTicker: null,
    selectedTickerSource: null,
    selection: null,
    workspaceMode: 'split',
    fullscreen: false,
    analysisTab: 'overview',
  });
});

describe('Today page — keyboard navigation syncs with click', () => {
  it('pressing j after clicking the second item advances to the third, not from keyboard position 0', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-16' })
      ),
      http.get('*/api/daily-review', () =>
        HttpResponse.json(threeCloseItemReview)
      )
    );

    renderWithProviders(<Today />);

    // Wait for all three rows to appear
    const nvdaButton = await screen.findByRole('button', { name: /NVDA/i });

    // Click the second item (NVDA, flat-list index 1)
    fireEvent.click(nvdaButton);

    // Pressing j should advance from NVDA (index 1) → MSFT (index 2)
    // Without the fix, j moves from focusedIndex -1 → 0 (AMAT), not NVDA → MSFT
    fireEvent.keyDown(nvdaButton, { key: 'j' });

    expect(useWorkspaceStore.getState().selectedTicker).toBe('MSFT');
    expect(
      within(screen.getByTestId('symbol-rail-list')).getByRole('button', { name: /MSFT/i }),
    ).toHaveAttribute('aria-current', 'true');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        typeof message === 'string' && message.includes('Cannot update a component'),
      ),
    ).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('does not navigate when the shortcut originates outside the Today list', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () => HttpResponse.json({ orders: [], asof: '2026-05-16' })),
      http.get('*/api/daily-review', () => HttpResponse.json(threeCloseItemReview)),
    );
    renderWithProviders(<Today />);
    await screen.findByRole('button', { name: /NVDA/i });
    useWorkspaceStore.getState().clearSelectedTicker();

    fireEvent.keyDown(document.body, { key: 'j' });

    expect(useWorkspaceStore.getState().selectedTicker).toBeNull();
  });
});

describe('Today page — accessibility', () => {
  it('refresh button has an explicit aria-label, not just a title attribute', async () => {
    renderWithProviders(<Today />);
    // title alone is ignored by screen readers on buttons in many browsers;
    // aria-label is required for reliable accessible name announcement
    const refreshButton = await screen.findByRole('button', {
      name: t('dailyReview.header.refreshTitle'),
    });
    expect(refreshButton).toHaveAttribute('aria-label', t('dailyReview.header.refreshTitle'));
  });
});

describe('Today page — detail panel', () => {
  it('restores focus to the originating row after closing the detail panel', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-16' })
      ),
      http.get('*/api/daily-review', () => HttpResponse.json(threeCloseItemReview)),
    );
    useWorkspaceStore.getState().clearSelectedTicker();
    const { user } = renderWithProviders(<Today />);
    const tickerButton = await screen.findByRole('button', { name: /NVDA/i });

    await user.click(tickerButton);
    expect(screen.getByTestId('symbol-detail-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('cockpit.detail.close') }));

    expect(screen.queryByTestId('symbol-detail-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /NVDA/i })).toHaveFocus();
  });
});

describe('Today page — pending orders badge', () => {
  it('shows pending orders badge when orders exist', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({
          orders: [{
            order_id: 'ORD-SBMO-001',
            ticker: 'SBMO',
            status: 'pending',
            order_kind: 'entry',
            order_type: 'LIMIT',
            quantity: 200,
            limit_price: 12.50,
            stop_price: 11.20,
            order_date: '2026-04-25',
            filled_date: null,
            entry_price: null,
            notes: '',
            parent_order_id: null,
            position_id: null,
            tif: 'GTC',
            fee_eur: null,
            fill_fx_rate: null,
          }],
          asof: '2026-04-28',
        })
      )
    );
    renderWithProviders(<Today />);
    expect(
      await screen.findByText(t('todayPage.pendingBadge.singular', { count: '1' }))
    ).toBeInTheDocument();
  });

  it('hides pending orders badge when no orders', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-28' })
      )
    );
    renderWithProviders(<Today />);
    await screen.findByRole('heading').catch(() => null); // wait for render
    expect(
      screen.queryByText(t('todayPage.pendingBadge.singular', { count: '1' }))
    ).not.toBeInTheDocument();
  });

  it('renders "Requires Action" section before "Watchlist nearing trigger" section when both are present', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-04' })
      ),
      http.get('*/api/daily-review', () =>
        HttpResponse.json({
          watchlist_near_trigger: [
            {
              ticker: 'ASML',
              watched_at: '2026-05-01T10:00:00Z',
              watch_price: 660,
              currency: 'EUR',
              source: 'screener',
              current_price: 671,
              signal_trigger_price: 680,
              distance_to_trigger_pct: -1.3,
              price_history: [],
            },
          ],
          new_candidates: [],
          positions_add_on_candidates: [],
          positions_hold: [],
          positions_update_stop: [],
          positions_close: [
            {
              position_id: 'pos-NVDA-001',
              ticker: 'NVDA',
              entry_price: 150,
              stop_price: 140,
              current_price: 138,
              r_now: -1.2,
              days_open: 5,
              time_stop_warning: false,
              reason: 'Price broke below stop',
            },
          ],
          summary: {
            total_positions: 1,
            no_action: 0,
            update_stop: 0,
            close_positions: 1,
            new_candidates: 0,
            add_on_candidates: 0,
            watchlist_near_trigger: 1,
            review_date: '2026-05-04',
          },
        })
      )
    );

    renderWithProviders(<Today />);

    // Wait for both sections to appear
    const requiresActionEl = await screen.findByText(new RegExp(t('todayPage.actionList.requiresAction'), 'i'));
    const watchlistEl = screen.getByText(new RegExp(t('watchlist.pipeline.dailyReviewTitle'), 'i'));

    // "Requires Action" must come before "Watchlist nearing trigger" in the DOM
    expect(
      requiresActionEl.compareDocumentPosition(watchlistEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('does not show daily-review filters in the beginner-default action list', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-04' })
      ),
      http.get('*/api/portfolio/positions', () =>
        HttpResponse.json({ positions: [], asof: '2026-05-04' })
      ),
    );

    renderWithProviders(<Today />);

    await screen.findByText(t('todayPage.actionList.empty'));

    expect(screen.queryByLabelText(t('dailyReview.filter.recommendedOnly'))).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t('screener.controls.actionFilter'))).not.toBeInTheDocument();
  });

  it('shows watchlist near-trigger section when daily review returns matches', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-28' })
      ),
      http.get('*/api/daily-review', () =>
        HttpResponse.json({
          watchlist_near_trigger: [
            {
              ticker: 'ASML',
              watched_at: '2026-05-01T10:00:00Z',
              watch_price: 660,
              currency: 'EUR',
              source: 'screener',
              current_price: 671,
              signal_trigger_price: 680,
              distance_to_trigger_pct: -1.3,
              price_history: [],
            },
          ],
          new_candidates: [],
          positions_add_on_candidates: [],
          positions_hold: [],
          positions_update_stop: [],
          positions_close: [],
          summary: {
            total_positions: 0,
            no_action: 0,
            update_stop: 0,
            close_positions: 0,
            new_candidates: 0,
            add_on_candidates: 0,
            watchlist_near_trigger: 1,
            review_date: '2026-05-04',
          },
        })
      )
    );

    renderWithProviders(<Today />);
    expect(await screen.findByText(new RegExp(t('watchlist.pipeline.dailyReviewTitle'), 'i'))).toBeInTheDocument();
    expect(screen.getByText('ASML')).toBeInTheDocument();
  });
});

// ── Open positions section ──────────────────────────────────────────────────────

const emptyReview = {
  watchlist_near_trigger: [],
  positions_add_on_candidates: [],
  positions_hold: [],
  positions_update_stop: [],
  positions_exit_signal: [],
  new_candidates: [],
  positions_close: [],
  summary: {
    total_positions: 0,
    no_action: 0,
    update_stop: 0,
    close_positions: 0,
    new_candidates: 0,
    add_on_candidates: 0,
    watchlist_near_trigger: 0,
    review_date: '2026-06-23',
  },
};

function makeOpenPosition(ticker: string, positionId: string) {
  return {
    position_id: positionId,
    ticker,
    status: 'open',
    entry_date: '2026-06-16',
    entry_price: 383.04,
    stop_price: 346.3,
    target_price: 456.52,
    shares: 1,
    initial_risk: 36.74,
    source_order_id: 'ORD-LRCX-001',
    exit_date: null,
    exit_price: null,
    current_price: 409.54,
    notes: '',
    exit_order_ids: null,
    pnl: 26.5,
    pnl_percent: 6.9,
    r_now: 0.72,
    entry_value: 383.04,
    current_value: 409.54,
    per_share_risk: 36.74,
    total_risk: 36.74,
    days_open: 7,
    time_stop_warning: false,
  };
}

describe('Today page — open positions section', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-06-23' })
      ),
      http.get('*/api/daily-review', () => HttpResponse.json(emptyReview)),
      http.get('*/api/portfolio/positions', () =>
        HttpResponse.json({ positions: [makeOpenPosition('LRCX', 'POS-520CACE4')], asof: '2026-06-23' })
      )
    );
  });

  it('renders an open positions section listing the held symbol', async () => {
    renderWithProviders(<Today />);
    expect(
      await screen.findByText(new RegExp(t('todayPage.actionList.openPositions'), 'i'))
    ).toBeInTheDocument();
    expect(screen.getByText('LRCX')).toBeInTheDocument();
  });

  it('shows the current R for the open position', async () => {
    renderWithProviders(<Today />);
    await screen.findByText('LRCX');
    expect(screen.getByText(/\+0\.72R/)).toBeInTheDocument();
  });
});

// ── Advanced scan controls ─────────────────────────────────────────────────────

describe('Today page — advanced scan controls', () => {
  it('does not show catalyst scan or intelligence sweep controls in the beginner-default action list', async () => {
    server.use(
      http.get('*/api/portfolio/positions', () =>
        HttpResponse.json({ positions: [], asof: '2026-06-23' })
      )
    );
    renderWithProviders(<Today />);

    await screen.findByText(t('todayPage.actionList.empty'));

    expect(screen.queryByRole('button', { name: t('todayPage.actionList.catalystScan') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('todayPage.actionList.intelligenceSweep') })).not.toBeInTheDocument();
  });
});

// ── Pending orders review section ─────────────────────────────────────────────

function makePendingOrderReview(
  ticker: string,
  orderId: string,
  category: 'stale' | 'still_valid' | 'no_data' = 'stale',
  daysPending = 7,
) {
  return { order_id: orderId, ticker, category, days_pending: daysPending };
}

const reviewWithPendingOrders = {
  watchlist_near_trigger: [],
  positions_add_on_candidates: [],
  positions_hold: [],
  positions_update_stop: [],
  new_candidates: [],
  positions_close: [],
  pending_orders_review: [
    makePendingOrderReview('TSLA', 'ORD-TSLA-001', 'stale', 8),
    makePendingOrderReview('AMD', 'ORD-AMD-001', 'still_valid', 2),
  ],
  summary: {
    total_positions: 0,
    no_action: 0,
    update_stop: 0,
    close_positions: 0,
    new_candidates: 0,
    add_on_candidates: 0,
    watchlist_near_trigger: 0,
    review_date: '2026-05-16',
  },
};

describe('Today page — pending orders review section', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().clearSelectedTicker();
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-05-16' })
      ),
      http.get('*/api/daily-review', () =>
        HttpResponse.json(reviewWithPendingOrders)
      )
    );
  });

  it('renders pending rows and their distinct statuses', async () => {
    renderWithProviders(<Today />);
    const actionList = screen.getByTestId('today-action-list');
    expect(
      await within(actionList).findByText(new RegExp(t('todayPage.actionList.pendingOrdersSection'), 'i'))
    ).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('AMD')).toBeInTheDocument();
    expect(
      screen.getByText(t('todayPage.actionList.pendingOrdersCategory.stale'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(t('todayPage.actionList.pendingOrdersCategory.still_valid'))
    ).toBeInTheDocument();
  });

  it('pending orders section appears before watchlist near-trigger in the DOM', async () => {
    server.use(
      http.get('*/api/daily-review', () =>
        HttpResponse.json({
          ...reviewWithPendingOrders,
          watchlist_near_trigger: [
            {
              ticker: 'ASML',
              watched_at: '2026-05-01T10:00:00Z',
              watch_price: 660,
              currency: 'EUR',
              source: 'screener',
              current_price: 671,
              signal_trigger_price: 680,
              distance_to_trigger_pct: -1.3,
              price_history: [],
            },
          ],
          summary: { ...reviewWithPendingOrders.summary, watchlist_near_trigger: 1 },
        })
      )
    );

    renderWithProviders(<Today />);

    const actionList = screen.getByTestId('today-action-list');
    const pendingEl = await within(actionList).findByText(
      new RegExp(t('todayPage.actionList.pendingOrdersSection'), 'i')
    );
    const watchlistEl = within(actionList).getByText(
      new RegExp(t('watchlist.pipeline.dailyReviewTitle'), 'i')
    );

    expect(
      pendingEl.compareDocumentPosition(watchlistEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

// ── Cockpit composition (Task 5) ─────────────────────────────────────────────

function eligibleCockpitCandidate() {
  return {
    ticker: 'adyen',
    name: 'Adyen N.V.',
    currency: 'EUR',
    close: 1400,
    sma20: null,
    sma50: null,
    sma200: null,
    atr: 25,
    momentum6m: 0,
    momentum12m: 0,
    relStrength: 0,
    score: 0.9,
    confidence: 90,
    rank: 1,
    technicalRank: 1,
    priorityRank: 1,
    rr: 2,
    executionEligibility: { allowed: true, mode: 'ready', reason: null },
    canonicalOrderDraft: {
      orderType: 'BUY_LIMIT',
      entry: 1400,
      stop: 1330,
      target: 1540,
      shares: 2,
      rr: 2,
      quoteCurrency: 'EUR',
      approvalToken: 'tok-adyen-1',
    },
    recommendation: {
      verdict: 'RECOMMENDED',
      workflowStatus: 'ready',
      nextStep: { code: 'review_order' },
    },
  };
}

describe('Today page — cockpit composition', () => {
  it('shows strip, queue and opens detail on row select without collapsing the list', async () => {
    useScreenerStore.setState({
      todayRun: null,
      lastRunContext: null,
      todayRunInitialized: true,
      lastResult: {
        asofDate: '2026-09-16',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [eligibleCockpitCandidate()],
      } as never,
    });
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-09-16' })
      ),
      http.get('*/api/daily-review', () => HttpResponse.json(emptyReview)),
    );
    const { user } = renderWithProviders(<Today />);
    expect(await screen.findByTestId('today-stats-strip')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-queue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `${t('cockpit.queue.reviewOrder')} ADYEN` }));
    expect(screen.getByTestId('symbol-detail-panel')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-queue')).toBeInTheDocument();
  });
});
