import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';

const { createOrderMock } = vi.hoisted(() => ({
  createOrderMock: vi.fn(),
}));

vi.mock('@/features/portfolio/api', () => ({
  createOrder: createOrderMock,
}));

const risk = {
  accountSize: 50000,
  riskPct: 0.01,
  maxPositionPct: 0.6,
  minShares: 1,
  kAtr: 2,
  minRr: 2,
  maxFeeRiskPct: 0.2,
};

const recommendedRecommendation = {
  verdict: 'RECOMMENDED' as const,
  reasonsShort: ['Signal active with valid stop.'],
  reasonsDetailed: [],
  risk: {
    entry: 175.5,
    stop: 170.0,
    target: 186.5,
    rr: 2.0,
    riskAmount: 11,
    riskPct: 0.00022,
    positionSize: 351,
    shares: 2,
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
};

describe('CandidateOrderModal', () => {
  beforeEach(() => {
    createOrderMock.mockReset();
    createOrderMock.mockResolvedValue({});
  });

  it('disables create action for not recommended candidate', () => {
    render(
      <CandidateOrderModal
        candidate={{
          ticker: 'VALE',
          entry: 17.38,
          stop: 16.36,
          shares: 8,
          recommendation: {
            verdict: 'NOT_RECOMMENDED',
            reasonsShort: ['RR below threshold'],
            reasonsDetailed: [],
            risk: {
              entry: 17.38,
              stop: 16.36,
              target: 19.42,
              rr: 1.0,
              riskAmount: 8.16,
              riskPct: 0.0082,
              positionSize: 139.04,
              shares: 8,
            },
            costs: {
              commissionEstimate: 0,
              fxEstimate: 0,
              slippageEstimate: 0,
              totalCost: 0,
              feeToRiskPct: 0.02,
            },
            checklist: [],
            education: {
              commonBiasWarning: 'Do not chase',
              whatToLearn: 'Wait for better RR',
              whatWouldMakeValid: ['Raise target'],
            },
          },
        }}
        risk={risk}
        defaultNotes="From daily review"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Create Order' });
    expect(button).toBeDisabled();
  });

  it('defaults to BUY_STOP when backend guidance suggests breakout stop entry', () => {
    render(
      <CandidateOrderModal
        candidate={{
          ticker: 'AAPL',
          signal: 'breakout',
          close: 175.0,
          entry: 175.5,
          stop: 170.0,
          shares: 2,
          recommendation: recommendedRecommendation,
          suggestedOrderType: 'BUY_STOP',
          suggestedOrderPrice: 175.6,
          executionNote: 'Breakout not triggered yet. Place BUY STOP slightly above breakout_level.',
        }}
        risk={risk}
        defaultNotes="From daily review"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Setup Execution (Degiro)')).toBeInTheDocument();
    expect(screen.getByText('Breakout setup')).toBeInTheDocument();
    expect(screen.getAllByText(/BUY STOP/i).length).toBeGreaterThan(0);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('BUY_STOP');
    expect(screen.getByText('Exact Degiro setup for this order')).toBeInTheDocument();
    expect(screen.getByText(/Tipo di Ordine: Stop Loss \(Buy Stop entry trigger\)/i)).toBeInTheDocument();
    expect(screen.getByText(/2\) Protective stop after entry fill \(Vendita\)/i)).toBeInTheDocument();
  });

  it('shows pullback execution guidance when breakout signal is already passed and backend suggests BUY_LIMIT', () => {
    render(
      <CandidateOrderModal
        candidate={{
          ticker: 'AAPL',
          signal: 'breakout',
          close: 175.0,
          entry: 175.5,
          stop: 170.0,
          shares: 2,
          recommendation: recommendedRecommendation,
          suggestedOrderType: 'BUY_LIMIT',
          suggestedOrderPrice: 174.2,
          executionNote: 'Breakout already occurred. Do NOT use buy-stop. Limit entry only on pullback.',
        }}
        risk={risk}
        defaultNotes="From daily review"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Pullback setup')).toBeInTheDocument();
    expect(screen.queryByText('Breakout setup')).not.toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('BUY_LIMIT');
    expect(screen.getByText(/Tipo di Ordine: Limite/i)).toBeInTheDocument();
  });

  it('requires override confirmation before submitting mismatch order type', async () => {
    const user = userEvent.setup();
    render(
      <CandidateOrderModal
        candidate={{
          ticker: 'AAPL',
          signal: 'breakout',
          close: 175.0,
          entry: 175.5,
          stop: 170.0,
          shares: 2,
          recommendation: recommendedRecommendation,
          suggestedOrderType: 'BUY_STOP',
          suggestedOrderPrice: 175.6,
        }}
        risk={risk}
        defaultNotes="From daily review"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'BUY_LIMIT');
    expect(screen.getByText(/Selected order type does not match strategy guidance/i)).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Create Order' });
    expect(submit).toBeDisabled();
    expect(createOrderMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });

  it('blocks BUY_STOP when trigger is not above current price', () => {
    render(
      <CandidateOrderModal
        candidate={{
          ticker: 'AAPL',
          signal: 'breakout',
          close: 175.0,
          entry: 175.0,
          stop: 170.0,
          shares: 2,
          recommendation: recommendedRecommendation,
          suggestedOrderType: 'BUY_STOP',
          suggestedOrderPrice: 175.0,
        }}
        risk={risk}
        defaultNotes="From daily review"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText(/Buy Stop trigger must be above current price/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Order' })).toBeDisabled();
  });

  it('renders fallback guidance when signal is missing', () => {
    render(
      <CandidateOrderModal
        candidate={{
          ticker: 'AAPL',
          entry: 175.5,
          stop: 170.0,
          shares: 2,
        }}
        risk={risk}
        defaultNotes="From daily review"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Manual setup')).toBeInTheDocument();
    expect(screen.getByText(/Choose BUY LIMIT for pullback or BUY STOP/i)).toBeInTheDocument();
  });
});
