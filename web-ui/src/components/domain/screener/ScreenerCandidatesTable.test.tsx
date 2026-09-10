import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { t } from '@/i18n/t';
import type { ScreenerCandidate } from '@/features/screener/types';

function candidate(overrides: Partial<ScreenerCandidate> = {}): ScreenerCandidate {
  const base: ScreenerCandidate = {
    ticker: 'GE',
    currency: 'USD',
    close: 377.52,
    sma20: 360,
    sma50: 350,
    sma200: 300,
    atr: 7.36,
    momentum6m: 0.34,
    momentum12m: 0.5,
    relStrength: 0.12,
    score: 0.82,
    confidence: 78,
    rank: 2,
    rr: 2,
    recommendation: {
      verdict: 'NOT_RECOMMENDED',
      reasonsShort: ['Entry condition has not triggered.'],
      reasonsDetailed: [{
        code: 'ENTRY_NOT_TRIGGERED',
        message: 'Waiting for the configured entry condition.',
        severity: 'block',
        metrics: {},
      }],
      risk: {
        entry: 375.06,
        stop: 367.7,
        target: 397.16,
        rr: 3,
        riskAmount: 73.6,
        riskPct: 0.01,
        positionSize: 3750.6,
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
        trigger: { status: 'WAIT', explanation: 'Waiting for breakout.' },
        plan: { status: 'PASS', explanation: 'Plan reconciles.' },
        portfolio: { status: 'UNKNOWN', explanation: 'Checked later.' },
        readyToOrder: false,
      },
      education: {
        commonBiasWarning: '',
        whatToLearn: '',
        whatWouldMakeValid: [],
      },
      workflowStatus: 'needs_review',
      nextStep: { code: 'define_target' },
    },
    decisionSummary: {
      symbol: 'GE',
      action: 'WAIT_FOR_BREAKOUT',
      conviction: 'low',
      technicalLabel: 'strong',
      fundamentalsLabel: 'neutral',
      valuationLabel: 'expensive',
      catalystLabel: 'unknown',
      whyNow: 'Wait for cleaner confirmation.',
      whatToDo: 'Watch the breakout level.',
      mainRisk: 'Valuation looks demanding.',
      tradePlan: { entry: 375.06, stop: 367.7, target: 397.16, rr: 3 },
      valuationContext: { method: 'earnings_multiple' },
      drivers: { positives: [], negatives: [], warnings: [], tradeState: [] },
    },
  };

  return { ...base, ...overrides };
}

describe('ScreenerCandidatesTable', () => {
  const workflows = {
    ready: { workflowStatus: 'ready', nextStep: { code: 'review_order' } },
    waiting: {
      workflowStatus: 'waiting_trigger',
      nextStep: { code: 'wait_pullback', triggerPrice: 46.2, currency: 'EUR' },
    },
    review: { workflowStatus: 'needs_review', nextStep: { code: 'define_target' } },
    noSetup: { workflowStatus: 'no_setup', nextStep: { code: 'observe' } },
  } as const;

  it('groups candidates by workflow with next actions and a ready-only order action', () => {
    server.use(http.get('/api/screener/recurrence', () => HttpResponse.json([])));

    renderWithProviders(
      <ScreenerCandidatesTable
        candidates={[
          candidate({
            ticker: 'READY',
            signal: 'breakout',
            recommendation: { ...candidate().recommendation!, ...workflows.ready },
            executionEligibility: { allowed: true, mode: 'ready', reason: null },
            canonicalOrderDraft: { orderType: 'BUY_STOP', entry: 375.06, stop: 367.7, target: 397.16, shares: 10, rr: 3, quoteCurrency: 'USD', approvalToken: 'signed' },
          }),
          candidate({ ticker: 'WAIT', signal: 'pullback', recommendation: { ...candidate().recommendation!, ...workflows.waiting } }),
          candidate({ ticker: 'REVIEW', recommendation: { ...candidate().recommendation!, ...workflows.review } }),
          candidate({
            ticker: 'NOSETUP',
            signal: 'none',
            decisionSummary: { ...candidate().decisionSummary!, action: 'BUY_ON_PULLBACK' },
            recommendation: { ...candidate().recommendation!, ...workflows.noSetup },
          }),
        ]}
        onCreateOrder={vi.fn()}
        onRecommendationDetails={vi.fn()}
      />
    );

    expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.getAttribute('aria-label') ?? node.textContent)).toEqual([
      t('screener.workflowGroups.ready.title'),
      t('screener.workflowGroups.waitingTrigger.title'),
      t('screener.workflowGroups.needsReview.title'),
      t('screener.workflowGroups.noSetup.title'),
    ]);
    expect(screen.getByText(t('recommendation.workflow.nextStep.wait_pullback', { price: '€46.20' }))).toBeInTheDocument();
    expect(screen.queryByText(t('screener.table.signalBadge.pullback'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('screener.table.reviewOrderAction') })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: t('screener.table.reviewOrderAction') })).toHaveLength(1);

    const readyHeading = screen.getByRole('heading', { name: t('screener.workflowGroups.ready.title') });
    const readySummary = readyHeading.closest('summary');
    expect(readyHeading.parentElement).toBe(readySummary);
    expect(Array.from(readySummary?.children ?? [])).toEqual([readyHeading]);
    expect(readyHeading).toContainElement(readySummary?.querySelector('[class*="h-2.5"]') ?? null);
    expect(readyHeading).toContainElement(screen.getByText(t('screener.workflowGroups.ready.description')));
    expect(Array.from(readyHeading.querySelectorAll('span')).some((node) => node.textContent === '1')).toBe(true);

    const noSetupGroup = screen.getByRole('heading', { name: t('screener.workflowGroups.noSetup.title') }).closest('section');
    expect(noSetupGroup).toContainElement(screen.getByText('NOSETUP'));
    expect(noSetupGroup?.querySelector('details')).not.toHaveAttribute('open');
  });

  it('keeps all workflow groups visible when there are no candidates', () => {
    server.use(http.get('/api/screener/recurrence', () => HttpResponse.json([])));

    renderWithProviders(
      <ScreenerCandidatesTable
        candidates={[]}
        onCreateOrder={vi.fn()}
        onRecommendationDetails={vi.fn()}
      />
    );

    expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.getAttribute('aria-label') ?? node.textContent)).toEqual([
      t('screener.workflowGroups.ready.title'),
      t('screener.workflowGroups.waitingTrigger.title'),
      t('screener.workflowGroups.needsReview.title'),
      t('screener.workflowGroups.noSetup.title'),
    ]);
    const noSetupGroup = screen.getByRole('heading', { name: t('screener.workflowGroups.noSetup.title') }).closest('section');
    expect(noSetupGroup?.querySelector('details')).not.toHaveAttribute('open');
  });

  it('activates selectable rows with the keyboard', async () => {
    server.use(http.get('/api/screener/recurrence', () => HttpResponse.json([])));
    const onRowClick = vi.fn();

    renderWithProviders(
      <ScreenerCandidatesTable
        candidates={[candidate()]}
        onCreateOrder={vi.fn()}
        onRecommendationDetails={vi.fn()}
        onRowClick={onRowClick}
      />
    );

    const row = screen.getByRole('button', { name: t('screener.table.selectRow', { ticker: 'GE' }) });
    row.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'GE' }));
  });
});
