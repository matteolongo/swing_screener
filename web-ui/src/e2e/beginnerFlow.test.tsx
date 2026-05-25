/**
 * Beginner flow regression tests (PR 10)
 *
 * Integration-level tests that compose multiple components to verify the
 * end-to-end beginner UX hierarchy is correct and repeatable. These tests
 * are written as Vitest + RTL + MSW tests (not Playwright browser tests)
 * because no playwright.config.ts exists in this project yet.
 *
 * Scenarios covered:
 *  1. TodayPriorityCard — close_position kind renders headline + action button
 *  2. TodayPriorityCard — run_screener kind when review is null
 *  3. ScreenerForm collapsed controls — "Adjust filters" + Run button present
 *  4. ScreenerCandidateReviewList — guided view is the component default
 *  5. ScreenerCandidateReviewList — "Advanced table" toggle text exists in ScreenerInboxPanel
 *  6. OrderReadinessGate watch_only — warning shown, children accessible
 *  7. OrderReadinessGate avoid — checkbox gating, children hidden until checked
 *  8. ScreenerCandidateReviewList — selecting a candidate calls onReview with correct ticker
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';

// Components under test
import TodayPriorityCard from '@/components/domain/today/TodayPriorityCard';
import ScreenerForm from '@/components/domain/screener/ScreenerForm';
import ScreenerCandidateReviewList from '@/components/domain/screener/ScreenerCandidateReviewList';
import OrderReadinessGate from '@/components/domain/orders/OrderReadinessGate';

// Logic
import { pickTodayPriority } from '@/features/dailyReview/beginnerPriority';

// Types
import type { DailyReview } from '@/features/dailyReview/types';
import type { ScreenerCandidate, DecisionAction } from '@/features/screener/types';
import type { UniverseSummary } from '@/features/screener/types';
import type { Recommendation } from '@/types/recommendation';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeEmptyReview(): DailyReview {
  return {
    watchlistNearTrigger: [],
    newCandidates: [],
    positionsAddOnCandidates: [],
    positionsHold: [],
    positionsUpdateStop: [],
    positionsClose: [],
    positionsExitSignal: [],
    summary: {
      totalPositions: 0,
      noAction: 0,
      updateStop: 0,
      closePositions: 0,
      newCandidates: 0,
      addOnCandidates: 0,
      watchlistNearTrigger: 0,
      exitSignal: 0,
      reviewDate: '2026-05-15',
    },
  };
}

function makeReviewWithClose(): DailyReview {
  return {
    ...makeEmptyReview(),
    positionsClose: [
      {
        positionId: 'POS-VALE-001',
        ticker: 'VALE',
        entryPrice: 15.89,
        stopPrice: 15.0,
        currentPrice: 14.8,
        rNow: -1.1,
        daysOpen: 5,
        timeStopWarning: false,
        reason: 'Stop triggered at 15.00.',
      },
    ],
    summary: {
      totalPositions: 1,
      noAction: 0,
      updateStop: 0,
      closePositions: 1,
      newCandidates: 0,
      addOnCandidates: 0,
      watchlistNearTrigger: 0,
      exitSignal: 0,
      reviewDate: '2026-05-15',
    },
  };
}

function makeRecommendation(): Recommendation {
  return {
    verdict: 'RECOMMENDED',
    reasonsShort: [],
    reasonsDetailed: [],
    risk: { entry: 150, riskAmount: 5, riskPct: 0.05, positionSize: 1000, shares: 10 },
    costs: { commissionEstimate: 1, fxEstimate: 0, slippageEstimate: 1, totalCost: 2 },
    checklist: [],
    education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
  };
}

function makeCandidate(ticker: string, action: DecisionAction = 'BUY_NOW'): ScreenerCandidate {
  return {
    ticker,
    currency: 'USD',
    close: 150,
    sma20: 148,
    sma50: 145,
    sma200: 140,
    atr: 2,
    momentum6m: 0.2,
    momentum12m: 0.3,
    relStrength: 1.1,
    score: 0.8,
    confidence: 75,
    rank: 1,
    recommendation: makeRecommendation(),
    decisionSummary: {
      symbol: ticker,
      action,
      conviction: 'high',
      technicalLabel: 'strong',
      fundamentalsLabel: 'strong',
      valuationLabel: 'fair',
      catalystLabel: 'active',
      whyNow: 'Breakout from base.',
      whatToDo: 'Buy at market open.',
      mainRisk: 'Volume not confirmed yet.',
      tradePlan: { entry: 150, stop: 145, target: 165, rr: 3 },
      valuationContext: { method: 'not_available' },
      drivers: {
        positives: ['Strong momentum'],
        negatives: [],
        warnings: [],
      },
      catalystSummary: null,
      catalystSources: [],
    },
  };
}

const mockUniverse: UniverseSummary = {
  id: 'broad_market_stocks',
  description: 'Broad Market Stocks',
  kind: 'equity',
  benchmark: 'SPY',
  member_count: 500,
  source: 'manual',
  source_asof: '2026-01-01',
  last_reviewed_at: '2026-01-01',
  stale_after_days: 30,
  currencies: ['USD'],
  exchange_mics: ['XNYS', 'XNAS'],
  source_adapter: 'manual',
  source_documents: [],
  refreshable: false,
  days_since_review: 0,
  freshness_status: 'fresh',
  is_stale: false,
};

const defaultScreenerFormProps = {
  selectedUniverse: 'broad_market_stocks',
  setSelectedUniverse: vi.fn(),
  topN: 20,
  setTopN: vi.fn(),
  minPrice: 5,
  setMinPrice: vi.fn(),
  maxPrice: 500,
  setMaxPrice: vi.fn(),
  currencyFilter: 'all' as const,
  setCurrencyFilter: vi.fn(),
  exchangeFilter: 'all' as const,
  setExchangeFilter: vi.fn(),
  instrumentFilter: 'all' as const,
  setInstrumentFilter: vi.fn(),
  includeOtc: false,
  setIncludeOtc: vi.fn(),
  recommendedOnly: false,
  setRecommendedOnly: vi.fn(),
  requireWeeklyUptrend: false,
  setRequireWeeklyUptrend: vi.fn(),
  actionFilter: 'all' as const,
  setActionFilter: vi.fn(),
  universes: [mockUniverse],
  isLoading: false,
  onRun: vi.fn(),
  onToggleCollapsed: vi.fn(),
};

// ── Scenario 1: Today page priority card — close_position kind ────────────────

describe('Scenario 1: TodayPriorityCard with close_position priority', () => {
  it('renders the close_position headline derived from pickTodayPriority', () => {
    const review = makeReviewWithClose();
    const priority = pickTodayPriority(review, 0, undefined);

    expect(priority.kind).toBe('close_position');
    renderWithProviders(
      <TodayPriorityCard priority={priority} onAction={vi.fn()} />
    );

    expect(screen.getByText('VALE needs to be closed')).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.todayPriorityCard.kinds.close_position'))).toBeInTheDocument();
  });

  it('renders the action button for close_position', () => {
    const review = makeReviewWithClose();
    const priority = pickTodayPriority(review, 0, undefined);

    renderWithProviders(
      <TodayPriorityCard priority={priority} onAction={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: t('todayPage.todayPriorityCard.action.close_position') })).toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', async () => {
    const onAction = vi.fn();
    const review = makeReviewWithClose();
    const priority = pickTodayPriority(review, 0, undefined);

    const { user } = renderWithProviders(
      <TodayPriorityCard priority={priority} onAction={onAction} />
    );

    await user.click(screen.getByRole('button', { name: t('todayPage.todayPriorityCard.action.close_position') }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});

// ── Scenario 2: Today page with no review data — run_screener ─────────────────

describe('Scenario 2: TodayPriorityCard with null review data', () => {
  it('shows run_screener priority when review is null', () => {
    const priority = pickTodayPriority(null, 0, undefined);

    expect(priority.kind).toBe('run_screener');
    renderWithProviders(
      <TodayPriorityCard priority={priority} onAction={vi.fn()} />
    );

    expect(screen.getByText(t('todayPage.todayPriorityCard.kinds.run_screener'))).toBeInTheDocument();
    expect(screen.getByText(t('todayPage.todayPriorityCard.headline.run_screener'))).toBeInTheDocument();
  });

  it('shows run_screener action button', () => {
    const priority = pickTodayPriority(null, 0, undefined);

    renderWithProviders(
      <TodayPriorityCard priority={priority} onAction={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: t('todayPage.todayPriorityCard.action.run_screener') })).toBeInTheDocument();
  });

  it('shows no_action kind when review is empty and no best candidate', () => {
    const review = makeEmptyReview();
    const priority = pickTodayPriority(review, 0, undefined);

    expect(priority.kind).toBe('no_action');
    renderWithProviders(
      <TodayPriorityCard priority={priority} onAction={vi.fn()} />
    );

    expect(screen.getByText(t('todayPage.todayPriorityCard.kinds.no_action'))).toBeInTheDocument();
  });
});

// ── Scenario 3: Screener collapsed controls ───────────────────────────────────

describe('Scenario 3: ScreenerForm collapsed controls', () => {
  it('shows "Adjust filters" button in collapsed mode', () => {
    renderWithProviders(
      <ScreenerForm {...defaultScreenerFormProps} isCollapsed={true} />
    );

    expect(screen.getByText(t('screener.controls.adjustFilters'))).toBeInTheDocument();
  });

  it('shows Run Screener button in collapsed mode', () => {
    renderWithProviders(
      <ScreenerForm {...defaultScreenerFormProps} isCollapsed={true} />
    );

    expect(screen.getByText(t('screener.controls.run'))).toBeInTheDocument();
  });

  it('"Adjust filters" button is accessible as a button element', () => {
    renderWithProviders(
      <ScreenerForm {...defaultScreenerFormProps} isCollapsed={true} />
    );

    const adjustBtn = screen.getByRole('button', { name: t('screener.controls.adjustFilters') });
    expect(adjustBtn).toBeInTheDocument();
  });

  it('Universe description is shown in collapsed mode', () => {
    renderWithProviders(
      <ScreenerForm {...defaultScreenerFormProps} isCollapsed={true} />
    );

    expect(screen.getByText('Broad Market Stocks')).toBeInTheDocument();
  });
});

// ── Scenario 4: Screener results — ScreenerCandidateReviewList renders ────────

describe('Scenario 4: ScreenerCandidateReviewList — guided view is default', () => {
  it('renders the guided list with candidate tickers', () => {
    const candidates = [makeCandidate('AAPL'), makeCandidate('MSFT')];

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={candidates}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('renders Review buttons for each candidate row', () => {
    const candidates = [makeCandidate('AAPL'), makeCandidate('MSFT')];

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={candidates}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    const reviewButtons = screen.getAllByRole('button', { name: t('screener.guidedList.review') });
    expect(reviewButtons).toHaveLength(2);
  });

  it('does not render Create Order button in the guided list rows', () => {
    const candidates = [makeCandidate('AAPL')];

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={candidates}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: t('common.actions.createOrder') })).not.toBeInTheDocument();
  });
});

// ── Scenario 5: view toggle labels are correct ────────────────────────────────

describe('Scenario 5: View toggle — guided and advanced labels', () => {
  it('guided view label matches i18n key screener.viewToggle.guided', () => {
    // Smoke-test: verifies the i18n key values resolve to the expected strings.
    // The toggle buttons live in ScreenerInboxPanel, which requires heavy API
    // mocks (universe list, screener results, store wiring) to render in
    // isolation. Those integration concerns are covered by
    // ScreenerInboxPanel.test.tsx. Here we only confirm that the key values
    // are stable so renames surface as test failures.
    expect(t('screener.viewToggle.guided')).toBe('Guided');
    expect(t('screener.viewToggle.advanced')).toBe('Advanced table');
  });

  it('guided list renders guided-specific UI (quality badge and readiness chip) not table headers', () => {
    const candidate = makeCandidate('TSLA', 'BUY_NOW');

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={[candidate]}
        selectedTicker={null}
        onReview={vi.fn()}
      />
    );

    // Quality badge present — exclusive to guided list
    expect(screen.getByText(t('screener.guidedList.quality.pass'))).toBeInTheDocument();
    // Readiness chip present — exclusive to guided list
    expect(screen.getByText(t('screener.guidedList.readiness.ready'))).toBeInTheDocument();
  });
});

// ── Scenario 6: OrderReadinessGate watch_only ─────────────────────────────────

describe('Scenario 6: OrderReadinessGate watch_only — warning shown, children accessible', () => {
  const CHILD = 'Place order here';

  it('shows not-ready warning banner for watch_only', () => {
    renderWithProviders(
      <OrderReadinessGate readiness="watch_only">
        <div>{CHILD}</div>
      </OrderReadinessGate>
    );

    expect(screen.getByText(t('orderGate.notReadyWarning'))).toBeInTheDocument();
  });

  it('children are still rendered (accessible) for watch_only', () => {
    renderWithProviders(
      <OrderReadinessGate readiness="watch_only">
        <div>{CHILD}</div>
      </OrderReadinessGate>
    );

    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it('does not show checkbox for watch_only (no hard gate)', () => {
    renderWithProviders(
      <OrderReadinessGate readiness="watch_only">
        <div>{CHILD}</div>
      </OrderReadinessGate>
    );

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

// ── Scenario 7: OrderReadinessGate avoid ─────────────────────────────────────

describe('Scenario 7: OrderReadinessGate avoid — checkbox gating', () => {
  const CHILD = 'Dangerous order form';

  it('shows avoid warning banner', () => {
    renderWithProviders(
      <OrderReadinessGate readiness="avoid">
        <div>{CHILD}</div>
      </OrderReadinessGate>
    );

    expect(screen.getByText(t('orderGate.avoidWarning'))).toBeInTheDocument();
  });

  it('shows override checkbox for avoid readiness', () => {
    renderWithProviders(
      <OrderReadinessGate readiness="avoid">
        <div>{CHILD}</div>
      </OrderReadinessGate>
    );

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('hides children until checkbox is checked', () => {
    renderWithProviders(
      <OrderReadinessGate readiness="avoid">
        <div>{CHILD}</div>
      </OrderReadinessGate>
    );

    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
  });

  it('reveals children after checkbox is checked', async () => {
    const { user } = renderWithProviders(
      <OrderReadinessGate readiness="avoid">
        <div>{CHILD}</div>
      </OrderReadinessGate>
    );

    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });
});

// ── Scenario 8: Selecting a candidate calls onReview with correct ticker ──────

describe('Scenario 8: ScreenerCandidateReviewList — candidate selection', () => {
  it('calls onReview with the correct ticker when Review button is clicked', async () => {
    const onReview = vi.fn();
    const candidates = [makeCandidate('NVDA'), makeCandidate('AMD')];

    const { user } = renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={candidates}
        selectedTicker={null}
        onReview={onReview}
      />
    );

    const reviewButtons = screen.getAllByRole('button', { name: t('screener.guidedList.review') });
    await user.click(reviewButtons[0]);
    expect(onReview).toHaveBeenCalledWith('NVDA');
  });

  it('calls onReview with the correct ticker when ticker text is clicked', async () => {
    const onReview = vi.fn();
    const candidates = [makeCandidate('NVDA'), makeCandidate('AMD')];

    const { user } = renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={candidates}
        selectedTicker={null}
        onReview={onReview}
      />
    );

    await user.click(screen.getByRole('button', { name: 'AMD' }));
    expect(onReview).toHaveBeenCalledWith('AMD');
  });

  it('highlights selected ticker row with bg-blue-50', () => {
    const candidates = [makeCandidate('NVDA'), makeCandidate('AMD')];

    renderWithProviders(
      <ScreenerCandidateReviewList
        candidates={candidates}
        selectedTicker="NVDA"
        onReview={vi.fn()}
      />
    );

    // Find each ticker button and check that the parent row div carries the selection class.
    const nvdaBtn = screen.getByRole('button', { name: 'NVDA' });
    const amdBtn = screen.getByRole('button', { name: 'AMD' });
    const nvdaRow = nvdaBtn.closest('[class*="flex items-start"]');
    const amdRow = amdBtn.closest('[class*="flex items-start"]');

    expect(nvdaRow?.className).toContain('bg-blue-50');
    expect(amdRow?.className).not.toContain('bg-blue-50');
  });
});
