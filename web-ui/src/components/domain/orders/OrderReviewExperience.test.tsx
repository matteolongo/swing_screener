import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import OrderReviewExperience from './OrderReviewExperience';
import type { OrderReviewContext } from './OrderReviewExperience';
import type { RiskConfig } from '@/types/config';
import type { Recommendation } from '@/types/recommendation';

vi.mock('@/features/portfolio/api', () => ({
  fetchPortfolioSummary: () =>
    Promise.resolve({
      totalPositions: 0,
      totalValue: 0,
      totalCostBasis: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      openRisk: 0,
      openRiskPercent: 0,
      accountSize: 50000,
      availableCapital: 50000,
      largestPositionValue: 0,
      largestPositionTicker: '',
      bestPerformerTicker: '',
      bestPerformerPnlPct: 0,
      worstPerformerTicker: '',
      worstPerformerPnlPct: 0,
      avgRNow: 0,
      positionsProfitable: 0,
      positionsLosing: 0,
      winRate: 0,
      concentration: [],
      realizedPnl: 0,
      effectiveAccountSize: 50000,
    }),
  createOrder: vi.fn().mockResolvedValue({}),
}));

const risk: RiskConfig = {
  accountSize: 50000,
  riskPct: 0.01,
  maxPositionPct: 0.6,
  minShares: 1,
  kAtr: 2,
  minRr: 2,
  maxFeeRiskPct: 0.2,
  maxConcentrationPct: 60,
  accountSizeMode: 'equity',
  accountCurrency: 'EUR',
};

function makeContext(overrides: Partial<OrderReviewContext> = {}): OrderReviewContext {
  return {
    ticker: 'AAPL',
    signal: 'breakout',
    entry: 20.0,
    stop: 18.0,
    close: 20.5,
    shares: 100,
    currency: 'USD',
    ...overrides,
  };
}

const waitingRecommendation: Recommendation = {
  verdict: 'NOT_RECOMMENDED',
  reasonsShort: ['The entry condition has not triggered.'],
  reasonsDetailed: [{
    code: 'ENTRY_NOT_TRIGGERED',
    message: 'Waiting for the configured entry condition.',
    severity: 'block',
    metrics: {},
  }],
  risk: {
    entry: 20,
    stop: 18,
    target: 24,
    targetSource: 'structural',
    rr: 2,
    riskAmount: 20,
    riskPct: 0.004,
    positionSize: 200,
    shares: 10,
  },
  costs: {
    commissionEstimate: 1,
    fxEstimate: 0,
    slippageEstimate: 1,
    totalCost: 2,
  },
  checklist: [],
  decisionGates: {
    setup: { status: 'PASS', explanation: 'Setup qualifies.' },
    trigger: { status: 'WAIT', explanation: 'Waiting for pullback.' },
    plan: { status: 'PASS', explanation: 'Plan reconciles.' },
    portfolio: { status: 'UNKNOWN', explanation: 'Checked during order review.' },
    readyToOrder: false,
  },
  education: {
    commonBiasWarning: '',
    whatToLearn: '',
    whatWouldMakeValid: [],
  },
};

describe('OrderReviewExperience — execution readiness', () => {
  it('presents a qualified conditional setup as waiting while keeping creation locked', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({
          recommendation: waitingRecommendation,
          dataStatus: 'current',
          dataAsOf: '2026-07-21',
        })}
        risk={risk}
        defaultNotes=""
        enforceRecommendation
        onSubmitOrder={vi.fn()}
      />
    );

    const readinessBadge = await screen.findByText(
      t('recommendation.readiness.WAITING_FOR_TRIGGER'),
    );
    const summaryCard = readinessBadge.closest('.rounded-xl');
    expect(summaryCard).toHaveClass('border-warning/40', 'bg-warning/10');
    expect(screen.getAllByText(
      t('order.candidateModal.executionNotReady', {
        status: t('recommendation.readiness.WAITING_FOR_TRIGGER'),
      }),
    ).length).toBeGreaterThan(0);
    expect(screen.getByText((_, node) => (
      node?.tagName === 'DIV'
      && (node.textContent?.startsWith(t('order.review.decisionLocked')) ?? false)
    ))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('order.candidateModal.createAction') })).toBeDisabled();
  });
});

describe('OrderReviewExperience — liquidity slippage warning', () => {
  it('shows slippage warning when order notional exceeds 5% of ADV', async () => {
    // shares=100, entry=20 → notional=2000; ADV=10_000 → 20% > 5% → warning
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ avgDailyVolumeEur: 10_000 })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    // Warning renders in two places (decision section + form) — getAllByText
    const matches = await screen.findAllByText(/20\.0%.*avg daily volume/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('does not show slippage warning when ADV is null', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ avgDailyVolumeEur: null })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    // Wait for form to be present
    await screen.findByRole('region', { name: /Order review sections/i });
    expect(screen.queryByText(/avg daily volume/i)).toBeNull();
  });

  it('does not show slippage warning when order notional is within 5% of ADV', async () => {
    // shares=100, entry=20 → notional=2000; ADV=1_000_000 → 0.2% < 5% → no warning
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ avgDailyVolumeEur: 1_000_000 })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    await screen.findByRole('region', { name: /Order review sections/i });
    expect(screen.queryByText(/avg daily volume/i)).toBeNull();
  });

  it('shows one clear order ticket heading and keeps broker details collapsed', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext()}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Order ticket' })).toBeInTheDocument();
    expect(screen.getAllByText('Execution caution')).toHaveLength(1);

    const brokerStep = screen.queryByText(/In Degiro Acquisto/i);
    if (brokerStep) {
      expect(brokerStep).not.toBeVisible();
    }
  });

  it('uses Degiro Limit entry instructions for a breakout second-chance BUY_LIMIT ticket', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({
          suggestedOrderType: 'BUY_LIMIT',
          suggestedOrderPrice: 19.4,
          executionNote: 'Breakout already occurred. Do NOT use buy-stop. Limit entry only on pullback.',
        })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );

    await screen.findByRole('heading', { name: 'Order ticket' });
    const degiroDetails = screen.getByText('Exact DeGiro setup').closest('details');
    expect(degiroDetails).not.toBeNull();
    const exactGuide = within(degiroDetails as HTMLElement);

    expect(exactGuide.getByText('Order type: Limit')).toBeInTheDocument();
    expect(exactGuide.getByText('Limit price: $19.40')).toBeInTheDocument();
    expect(exactGuide.queryByText('Order type: Stop Loss (Buy Stop entry trigger)')).not.toBeInTheDocument();
  });
});

describe('OrderReviewExperience — target price defaulting', () => {
  it('pre-fills the target from the R:R ratio when no explicit recommendation target exists', async () => {
    // entry=20, stop=18, rr=2 → target = 20 + 2*(20-18) = 24
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ rReward: 2 })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    const targetInput = await screen.findByLabelText(t('order.candidateModal.targetPrice'));
    expect(targetInput).toHaveValue(24);
  });

  it('leaves the target empty when neither a target nor an R:R ratio is available', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ rReward: undefined })}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    const targetInput = await screen.findByLabelText(t('order.candidateModal.targetPrice'));
    expect(targetInput).toHaveValue(null);
  });
});

describe('OrderReviewExperience — bottom sticky bar', () => {
  it('does not repeat the position/risk summary in the sticky bar', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext()}
        risk={risk}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );

    await screen.findByRole('region', { name: /Order review sections/i });

    const stickyBars = document.querySelectorAll('[class*="sticky"][class*="bottom-0"]');
    expect(stickyBars.length).toBe(1);
    expect(stickyBars[0].textContent ?? '').not.toMatch(/position/i);
  });
});
