import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import OrderReviewExperience from './OrderReviewExperience';
import type { OrderReviewContext } from './OrderReviewExperience';
import type { Recommendation } from '@/types/recommendation';

function makeContext(overrides: Partial<OrderReviewContext> = {}): OrderReviewContext {
  return {
    ticker: 'AAPL',
    signal: 'breakout',
    close: 20.5,
    canonicalOrderDraft: {
      orderType: 'BUY_STOP',
      entry: 20,
      stop: 18,
      target: 24,
      shares: 100,
      rr: 2,
      quoteCurrency: 'USD',
      approvalToken: 'signed-token',
    },
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
  workflowStatus: 'waiting_trigger',
  nextStep: { code: 'wait_pullback', triggerPrice: 20, currency: 'USD' },
};

describe('OrderReviewExperience — execution readiness', () => {
  it('keeps the no-candidate manual-order path usable', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ recommendation: undefined })}
        defaultNotes=""
        showManualOrderHint
        onSubmitOrder={vi.fn()}
      />,
    );

    expect(await screen.findByText(t('workspacePage.panels.analysis.manualOrderHint'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('order.candidateModal.createAction') })).toBeEnabled();
  });

  it('does not add a second local workflow gate to a canonical draft', async () => {
    const needsReviewRecommendation: Recommendation = {
      ...waitingRecommendation,
      verdict: 'RECOMMENDED',
      workflowStatus: 'needs_review',
      nextStep: { code: 'define_target' },
      decisionGates: {
        ...waitingRecommendation.decisionGates!,
        trigger: { status: 'PASS', explanation: 'Triggered.' },
        readyToOrder: true,
      },
    };
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({ recommendation: needsReviewRecommendation, dataStatus: 'current', dataAsOf: '2026-07-21' })}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', {
      name: t('order.candidateModal.createAction'),
    })).toBeEnabled();
  });

  it('allows a canonical ready recommendation with current data to proceed to review', async () => {
    const readyRecommendation: Recommendation = {
      ...waitingRecommendation,
      verdict: 'RECOMMENDED',
      workflowStatus: 'ready',
      nextStep: { code: 'review_order' },
      decisionGates: {
        ...waitingRecommendation.decisionGates!,
        trigger: { status: 'PASS', explanation: 'Triggered.' },
        readyToOrder: true,
      },
    };
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({
          recommendation: readyRecommendation,
          dataStatus: 'current',
          dataAsOf: '2026-07-21',
        })}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', {
      name: t('order.candidateModal.createAction'),
    })).toBeEnabled();
  });

  it('submits a signed waiting pullback BUY_LIMIT order with current data', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({
          recommendation: waitingRecommendation,
          dataStatus: 'current',
          dataAsOf: '2026-07-21',
        })}
        defaultNotes=""
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const submit = await screen.findByRole('button', {
      name: t('order.candidateModal.createAction'),
    });
    expect(submit).toBeEnabled();
    fireEvent.submit(submit.closest('form') as HTMLFormElement);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(onSubmitOrder).toHaveBeenCalledOnce());
    expect(onSubmitOrder).toHaveBeenCalledWith(expect.objectContaining({
      triggerStatus: 'WAIT',
    }));
  });

  it('keeps the canonical pending-pullback order type fixed', async () => {
    const onSubmitOrder = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({
          recommendation: waitingRecommendation,
          dataStatus: 'current',
          dataAsOf: '2026-07-21',
          canonicalOrderDraft: {
            orderType: 'BUY_LIMIT', entry: 20, stop: 18, target: 24, shares: 100, rr: 2, quoteCurrency: 'USD', approvalToken: 'approved-pullback-token',
          },
        })}
        defaultNotes=""
        onSubmitOrder={onSubmitOrder}
      />,
    );

    expect(screen.getByLabelText(t('order.candidateModal.orderType'))).toBeDisabled();
    expect(onSubmitOrder).not.toHaveBeenCalled();
  });

  it('presents a qualified conditional setup without recreating execution policy', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext({
          recommendation: waitingRecommendation,
          dataStatus: 'current',
          dataAsOf: '2026-07-21',
        })}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );

    const readinessBadge = await screen.findByText(
      t('recommendation.workflow.status.waitingTrigger'),
    );
    const summaryCard = readinessBadge.closest('.rounded-xl');
    expect(summaryCard).toHaveClass('border-warning/40', 'bg-warning/10');
    expect(screen.queryByText(t('order.review.decisionLocked'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('order.candidateModal.createAction') })).toBeEnabled();
  });
});

describe('OrderReviewExperience — order ticket', () => {
  it('shows one clear order ticket heading and keeps broker details collapsed', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext()}
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
          executionNote: 'Breakout already occurred. Do NOT use buy-stop. Limit entry only on pullback.',
          canonicalOrderDraft: {
            orderType: 'BUY_LIMIT', entry: 19.4, stop: 18, target: 22.2, shares: 100, rr: 2, quoteCurrency: 'USD', approvalToken: 'signed-token',
          },
        })}
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
  it('pre-fills the backend canonical target', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext()}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    const targetInput = await screen.findByLabelText(t('order.candidateModal.targetPrice'));
    expect(targetInput).toHaveValue(24);
  });

  it('does not clear a backend canonical target', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext()}
        defaultNotes=""
        onSubmitOrder={vi.fn()}
      />
    );
    const targetInput = await screen.findByLabelText(t('order.candidateModal.targetPrice'));
    expect(targetInput).toHaveValue(24);
  });
});

describe('OrderReviewExperience — bottom sticky bar', () => {
  it('does not repeat the position/risk summary in the sticky bar', async () => {
    renderWithProviders(
      <OrderReviewExperience
        context={makeContext()}
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
