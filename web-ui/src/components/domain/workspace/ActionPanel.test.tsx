import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import { renderWithProviders } from '@/test/utils';
import { useScreenerStore } from '@/stores/screenerStore';

const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
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
    mutate: mutateMock,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
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
          signal: 'breakout',
          entry: 100.5,
          stop: 97,
          shares: 10,
          recommendation: {
            verdict: 'RECOMMENDED',
            reasonsShort: [],
            reasonsDetailed: [],
            risk: {
              entry: 100.5,
              stop: 97,
              target: 107.5,
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
            education: {
              commonBiasWarning: '',
              whatToLearn: '',
              whatWouldMakeValid: [],
            },
          },
          ...overrides,
        },
      ],
    },
  });
}

describe('ActionPanel', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    setCandidate();
  });

  it('defaults to BUY_STOP when backend guidance suggests it', () => {
    setCandidate({
      suggestedOrderType: 'BUY_STOP',
      suggestedOrderPrice: 101.2,
    });
    renderWithProviders(<ActionPanel ticker="AAPL" />);

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('BUY_STOP');
    expect(screen.getByText('Trigger Price (Buy Stop entry in Degiro)')).toBeInTheDocument();
    expect(screen.getByText('Exact Degiro setup for this order')).toBeInTheDocument();
    expect(screen.getByText(/Tipo di Ordine: Stop Loss \(Buy Stop entry trigger\)/i)).toBeInTheDocument();
  });

  it('uses pullback execution guidance when breakout signal already passed with BUY_LIMIT suggestion', () => {
    setCandidate({
      signal: 'breakout',
      suggestedOrderType: 'BUY_LIMIT',
      suggestedOrderPrice: 99.4,
      executionNote: 'Breakout already occurred. Do NOT use buy-stop. Limit entry only on pullback.',
    });
    renderWithProviders(<ActionPanel ticker="AAPL" />);

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('BUY_LIMIT');
    expect(screen.getByText('Pullback setup')).toBeInTheDocument();
    expect(screen.queryByText('Breakout setup')).not.toBeInTheDocument();
    expect(screen.getByText(/Tipo di Ordine: Limite/i)).toBeInTheDocument();
  });

  it('requires override confirmation before submitting a mismatch order type', async () => {
    const user = userEvent.setup();
    setCandidate({
      suggestedOrderType: 'BUY_STOP',
      suggestedOrderPrice: 101.2,
    });
    renderWithProviders(<ActionPanel ticker="AAPL" />);

    await user.selectOptions(screen.getByRole('combobox'), 'BUY_LIMIT');
    expect(screen.getByText(/Selected order type does not match strategy guidance/i)).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Create Order' });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });

  it('blocks BUY_STOP entries when trigger is at or below current price', () => {
    setCandidate({
      suggestedOrderType: 'BUY_STOP',
      suggestedOrderPrice: 100,
      close: 100,
    });
    renderWithProviders(<ActionPanel ticker="AAPL" />);

    expect(screen.getByText(/Buy Stop trigger must be above current price/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Order' })).toBeDisabled();
  });
});
