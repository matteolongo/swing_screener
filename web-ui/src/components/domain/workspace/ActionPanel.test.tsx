import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import { renderWithProviders } from '@/test/utils';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import type { DecisionSummary, ScreenerCandidate } from '@/features/screener/types';
import { formatWorkflowNextStep } from '@/components/domain/recommendation/workflowPresentation';

const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
}));

const { openPositionsMock } = vi.hoisted(() => ({
  openPositionsMock: vi.fn(),
}));

vi.mock('@/features/strategy/hooks', () => ({
  useActiveStrategyQuery: () => ({
    data: {
      risk: {
        accountSize: 50000,
        riskPct: 0.01,
        maxPositionPct: 0.6,
        minShares: 1,
        kAtr: 2,
        minRr: 2,
        maxFeeRiskPct: 0.2,
      },
    },
  }),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  useCreateOrderMutation: () => ({
    mutateAsync: mutateMock,
  }),
  useEarningsProximity: () => ({
    data: undefined,
  }),
  useOpenPositions: () => ({
    data: openPositionsMock(),
  }),
  usePortfolioSummary: () => ({
    data: {
      openRisk: 0,
      concentration: [],
    },
  }),
}));

function setCandidate(overrides: Record<string, unknown> = {}) {
  useScreenerStore.setState({
    lastResult: {
      asofDate: '2026-03-02',
      totalScreened: 1,
      dataFreshness: 'final_close',
      candidates: [
        {
          ticker: 'AAPL',
          currency: 'USD',
          close: 100,
          sma20: 99,
          sma50: 98,
          sma200: 95,
          atr: 2,
          momentum6m: 0.2,
          momentum12m: 0.3,
          relStrength: 1.1,
          score: 0.8,
          confidence: 88,
          rank: 1,
          lastBar: '2026-03-02',
          dataStatus: 'current',
          approvalToken: 'signed-candidate-token',
          daysToEarnings: 20,
          signal: 'breakout',
          entry: 100.5,
          stop: 97,
          shares: 10,
          // Analytical decision summaries remain available for display only.
          decisionSummary: { action: 'BUY_NOW' } as unknown as DecisionSummary,
          recommendation: {
            verdict: 'RECOMMENDED',
            reasonsShort: [],
            reasonsDetailed: [],
            risk: {
              entry: 100.5,
              stop: 97,
              target: 107.5,
              desiredTarget: 107.5,
              targetSource: 'structural',
              rr: 2,
              riskAmount: 35,
              riskPct: 0.0007,
              positionSize: 1005,
              shares: 10,
            },
            costs: {
              commissionEstimate: 0,
              fxEstimate: 0,
              slippageEstimate: 0,
              totalCost: 0,
              feeToRiskPct: 0,
            },
            checklist: [],
            decisionGates: {
              setup: { status: 'PASS', explanation: 'Qualified.' },
              trigger: { status: 'PASS', explanation: 'Triggered.' },
              plan: { status: 'PASS', explanation: 'Reconciled.' },
              portfolio: { status: 'UNKNOWN', explanation: 'Checked on submit.' },
              readyToOrder: true,
            },
            education: {
              commonBiasWarning: '',
              whatToLearn: '',
              whatWouldMakeValid: [],
            },
            workflowStatus: 'ready',
            nextStep: { code: 'review_order' },
          },
          ...overrides,
          executionEligibility: ('executionEligibility' in overrides
            ? overrides.executionEligibility
            : 'recommendation' in overrides
              ? { allowed: false, mode: null, reason: 'workflow_not_actionable' }
              : { allowed: true, mode: 'ready', reason: null }) as ScreenerCandidate['executionEligibility'],
          canonicalOrderDraft: ('canonicalOrderDraft' in overrides
            ? overrides.canonicalOrderDraft
            : 'recommendation' in overrides
              ? undefined
              : {
                  orderType: 'BUY_STOP',
                  entry: 101.2,
                  stop: 97,
                  target: 109.6,
                  shares: 10,
                  rr: 2,
                  quoteCurrency: 'USD',
                  approvalToken: 'signed-candidate-token',
                }) as ScreenerCandidate['canonicalOrderDraft'],
        },
      ],
    },
  });
}

function renderPanel(source?: Parameters<typeof ActionPanel>[0]['source']) {
  return renderWithProviders(
    <ActionPanel ticker="AAPL" source={source} candidate={useScreenerStore.getState().lastResult?.candidates[0] ?? null} />,
  );
}

describe('ActionPanel', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    openPositionsMock.mockReset();
    openPositionsMock.mockReturnValue([]);
    setCandidate();
  });

  it.each([
    { name: 'no-data', arrange: () => useScreenerStore.setState({ lastResult: null }), expected: t('workspacePage.panels.analysis.orderUnavailable.noCandidate') },
    { name: 'fresh', phase: 'fresh', arrange: () => setCandidate({ dataStatus: 'current' }), expected: t('workspacePage.data.phases.fresh') },
    { name: 'cached', phase: 'cached', arrange: () => setCandidate({ dataStatus: 'current' }), expected: t('workspacePage.data.phases.cached') },
    { name: 'stale', phase: 'stale', arrange: () => setCandidate({ dataStatus: 'stale' }), expected: t('workspacePage.data.phases.stale') },
    { name: 'refreshing-with-data', phase: 'loading', arrange: () => setCandidate({ dataStatus: 'current' }), expected: t('workspacePage.data.phases.loading') },
    { name: 'partial', arrange: () => setCandidate({ recommendation: { workflowStatus: 'needs_review', nextStep: { code: 'refresh_data' } } }), expected: t('workspacePage.panels.analysis.orderUnavailable.title') },
    { name: 'failed', arrange: () => setCandidate({ recommendation: undefined }), expected: t('workspacePage.panels.analysis.orderUnavailable.noCandidate') },
    { name: 'timeout', arrange: () => setCandidate({ recommendation: { workflowStatus: 'needs_review', nextStep: { code: 'refresh_data' } } }), expected: t('workspacePage.panels.analysis.orderUnavailable.title') },
    { name: 'malformed', arrange: () => setCandidate({ recommendation: null }), expected: t('workspacePage.panels.analysis.orderUnavailable.noCandidate') },
  ])('renders its own $name workflow contract without an empty order panel', (testCase) => {
    const { arrange, expected } = testCase;
    arrange();
    const source = 'phase' in testCase ? {
      id: 'positionOrders' as const,
      ticker: 'AAPL',
      selectionVersion: 1,
      phase: testCase.phase as 'fresh' | 'cached' | 'stale' | 'loading',
      provider: 'local',
      dataAsOf: '2026-03-02',
      fetchedAt: '2026-03-02T20:00:00Z',
      cacheOrigin: testCase.phase === 'cached' ? 'memory' as const : 'network' as const,
      missingInputs: [],
      error: null,
    } : undefined;
    renderPanel(source);
    expect(screen.getByText(expected)).toBeVisible();
  });

  it('defaults to BUY_STOP when backend guidance suggests it', () => {
    setCandidate({
      suggestedOrderType: 'BUY_STOP',
      suggestedOrderPrice: 101.2,
    });
    renderPanel();

    expect(screen.getByRole('tab', { name: 'Decision' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Order ticket')).toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('BUY_STOP');
    expect(screen.getByText('Trigger Price (Buy Stop entry)')).toBeInTheDocument();
    expect(screen.getByText('Execution guide')).toBeInTheDocument();
  });

  it('keeps breakout setup guidance for a second-chance BUY_LIMIT after breakout triggered', () => {
    setCandidate({
      signal: 'breakout',
      suggestedOrderType: 'BUY_LIMIT',
      suggestedOrderPrice: 99.4,
      executionNote: 'Breakout already occurred. Do NOT use buy-stop. Limit entry only on pullback.',
      canonicalOrderDraft: {
        orderType: 'BUY_LIMIT', entry: 99.4, stop: 97, target: 104.2, shares: 10, rr: 2, quoteCurrency: 'USD', approvalToken: 'signed-candidate-token',
      },
    });
    renderPanel();

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('BUY_LIMIT');
    expect(screen.getAllByText(t('order.setupGuidance.signals.breakout.label')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Pullback setup')).toHaveLength(0);
    expect(screen.getAllByText(/buy-limit entry on a controlled retest/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Breakout already occurred/i)).toBeInTheDocument();
  });

  it('does not synthesize a breakout signal from an analytical BUY_NOW action', () => {
    setCandidate({
      signal: undefined,
      decisionSummary: { action: 'BUY_NOW' } as unknown as DecisionSummary,
    });
    renderPanel();

    expect(screen.queryAllByText(t('order.setupGuidance.signals.breakout.label'))).toHaveLength(0);
  });

  it('uses an explicit discovery candidate instead of a conflicting store candidate', () => {
    const storedCandidate = useScreenerStore.getState().lastResult!.candidates[0];
    const discoveryCandidate: ScreenerCandidate = {
      ...storedCandidate,
      recommendation: {
        ...storedCandidate.recommendation!,
        verdict: 'NOT_RECOMMENDED' as const,
        workflowStatus: 'no_setup' as const,
        nextStep: { code: 'observe' as const },
      },
      executionEligibility: { allowed: false, mode: null, reason: 'workflow_not_actionable' },
      canonicalOrderDraft: undefined,
    };

    renderWithProviders(<ActionPanel ticker="AAPL" candidate={discoveryCandidate} />);

    expect(screen.getByText(t('workspacePage.panels.analysis.orderUnavailable.title'))).toBeVisible();
    expect(screen.queryByRole('button', { name: t('order.candidateModal.createAction') })).not.toBeInTheDocument();
  });

  it('keeps the backend draft order type fixed in the review form', () => {
    setCandidate({
      suggestedOrderType: 'BUY_STOP',
      suggestedOrderPrice: 101.2,
    });
    renderPanel();

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('BUY_STOP');
  });

  it('does not open an order ticket when backend eligibility blocks a ready workflow', () => {
    setCandidate({
      executionEligibility: { allowed: false, mode: null, reason: 'plan_incomplete' },
      canonicalOrderDraft: undefined,
    });

    renderPanel();

    expect(screen.queryByRole('button', { name: t('order.candidateModal.createAction') })).not.toBeInTheDocument();
  });

  it('does not open an order ticket when backend guidance is SKIP', () => {
    setCandidate({
      suggestedOrderType: 'SKIP',
      executionEligibility: { allowed: false, mode: null, reason: 'skip_guidance' },
      canonicalOrderDraft: undefined,
    });
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Create Order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps form values while switching review sections', async () => {
    const user = userEvent.setup();
    renderPanel();

    const quantityInput = screen.getByLabelText('Quantity');
    await user.clear(quantityInput);
    await user.type(quantityInput, '12');

    await user.click(screen.getByRole('tab', { name: 'Risk / Invalidation' }));
    expect(screen.getByText(/No structured risk or invalidation notes are available/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Decision' }));
    expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('12');
  });

  it('explains why a non-ready candidate has no order form', () => {
    setCandidate({
      recommendation: {
        workflowStatus: 'needs_review',
        nextStep: { code: 'define_target' },
      },
    });

    renderPanel();

    expect(screen.queryByRole('button', { name: t('order.candidateModal.createAction') })).not.toBeInTheDocument();
    expect(screen.getByText(formatWorkflowNextStep({ code: 'define_target' }))).toBeVisible();
  });

  it('preserves order values after a failed submit', async () => {
    const user = userEvent.setup();
    mutateMock.mockRejectedValueOnce(new Error('Order service unavailable'));
    renderPanel();

    const quantityInput = screen.getByLabelText(t('order.candidateModal.quantity'));
    await user.clear(quantityInput);
    await user.type(quantityInput, '25');
    fireEvent.submit(
      screen.getByRole('button', { name: t('order.candidateModal.createAction') }).closest('form')!,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Order service unavailable');
    expect(quantityInput).toHaveValue(25);
  });

  it('keeps the action block below the review carousel', () => {
    renderPanel();

    const tablist = screen.getByRole('tablist', { name: 'Order review sections' });
    const formTitle = screen.getByText('Order ticket');

    expect(Boolean(tablist.compareDocumentPosition(formTitle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('includes screener score and confidence in the default notes', () => {
    renderPanel();

    expect(screen.getByLabelText('Notes')).toHaveValue(
      'From screener: Score 80.0, Confidence 88.0%, Rank #1'
    );
  });

  it('leaves BUY_STOP consistency to backend mutation validation', () => {
    setCandidate({
      suggestedOrderType: 'BUY_STOP',
      suggestedOrderPrice: 100,
      close: 100,
      canonicalOrderDraft: {
        orderType: 'BUY_STOP', entry: 100, stop: 97, target: 106, shares: 10, rr: 2, quoteCurrency: 'USD', approvalToken: 'signed-candidate-token',
      },
    });
    renderPanel();

    expect(screen.queryByText(/Buy Stop trigger must be above current price/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Order' })).toBeEnabled();
  });

  it.each([
    ['no same-symbol state', undefined],
    ['a canonical new-entry state', {
      mode: 'NEW_ENTRY',
      pendingEntryExists: false,
      addOnCount: 0,
      maxAddOns: 1,
      reason: 'Manage the existing position.',
    }],
  ])('does not show an order form for a held ready candidate with %s', (_label, sameSymbol) => {
    openPositionsMock.mockReturnValue([
      {
        ticker: 'AAPL',
        status: 'open',
        entryDate: '2026-03-10',
        entryPrice: 95,
        stopPrice: 90,
        shares: 10,
        positionId: 'POS-AAPL-1',
      },
    ]);
    setCandidate({ sameSymbol });

    renderPanel();

    expect(screen.queryByRole('button', { name: t('order.candidateModal.createAction') })).not.toBeInTheDocument();
    expect(screen.getByText(t('workspacePage.panels.analysis.orderUnavailable.title'))).toBeVisible();
  });

  it('submits a held candidate only from canonical ready ADD_ON state', async () => {
    openPositionsMock.mockReturnValue([
      {
        ticker: 'AAPL',
        status: 'open',
        entryDate: '2026-03-10',
        entryPrice: 95,
        stopPrice: 90,
        shares: 10,
        positionId: 'POS-AAPL-1',
      },
    ]);
    setCandidate({
      sameSymbol: {
        mode: 'ADD_ON',
        positionId: 'POS-AAPL-1',
        currentPositionEntry: 95,
        currentPositionStop: 90,
        freshSetupStop: 97,
        executionStop: 90,
        pendingEntryExists: false,
        addOnCount: 0,
        maxAddOns: 1,
        reason: 'Canonical add-on setup.',
      },
    });
    mutateMock.mockResolvedValue(undefined);

    renderPanel();

    expect(screen.getByLabelText('Notes')).toHaveValue(
      'Same-symbol add-on: Score 80.0, Confidence 88.0%, Rank #1, Live stop $90.00, Fresh setup stop $97.00'
    );

    const submit = screen.getByRole('button', { name: 'Create Order' });
    expect(submit).toBeEnabled();
    fireEvent.submit(submit.closest('form')!);

    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'AAPL',
          entryMode: 'ADD_ON',
          positionId: 'POS-AAPL-1',
        }),
      )
    );
  });
});
