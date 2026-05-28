import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';

function buildCandidate(overrides: Partial<SymbolAnalysisCandidate> = {}): SymbolAnalysisCandidate {
  return {
    ticker: 'AAPL',
    currency: 'USD',
    ...overrides,
  };
}

describe('AnalysisDecisionStrip — % to target cell', () => {
  it('shows % to target when entry and target are available', () => {
    const candidate = buildCandidate({ entry: 200, stop: 190 });
    const decisionSummary = {
      symbol: 'AAPL',
      action: 'BUY_NOW' as const,
      conviction: 'high' as const,
      technicalLabel: 'strong' as const,
      fundamentalsLabel: 'strong' as const,
      valuationLabel: 'fair' as const,
      catalystLabel: 'active' as const,
      catalystSummary: null,
      catalystSources: [],
      whyNow: '',
      whatToDo: '',
      mainRisk: '',
      tradePlan: { entry: 200, stop: 190, target: 220, rr: 2 },
      drivers: { positives: [], negatives: [], warnings: [] },
      valuationContext: {
        method: 'not_available' as const,
        summary: '',
        trailingPe: undefined,
        priceToSales: undefined,
        bookValuePerShare: undefined,
        priceToBook: undefined,
        bookToPrice: undefined,
        fairValueLow: undefined,
        fairValueBase: undefined,
        fairValueHigh: undefined,
        premiumDiscountPct: undefined,
      },
    };
    render(<AnalysisDecisionStrip ticker="AAPL" candidate={{ ...candidate, decisionSummary }} />);
    expect(screen.getByText('10.00%')).toBeInTheDocument();
  });

  it('shows dash when target is missing', () => {
    const candidate = buildCandidate({ entry: 200, stop: 190 });
    render(<AnalysisDecisionStrip ticker="AAPL" candidate={candidate} />);
    const toTargetLabel = screen.getByText('To Target');
    const cell = toTargetLabel.closest('div[class*="min-w"]');
    expect(cell?.textContent).toContain('—');
  });
});

describe('AnalysisDecisionStrip — Risk % cell', () => {
  it('shows dash when riskPct is 0', () => {
    const candidate = buildCandidate({
      recommendation: {
        verdict: 'RECOMMENDED',
        reasonsShort: [],
        reasonsDetailed: [],
        risk: { entry: 180, riskAmount: 5, riskPct: 0, positionSize: 1000, shares: 10 },
        costs: { commissionEstimate: 1, fxEstimate: 0, slippageEstimate: 0, totalCost: 1 },
        checklist: [],
        education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
      },
    });

    render(<AnalysisDecisionStrip ticker="AAPL" candidate={candidate} />);

    const riskLabel = screen.getAllByText('Risk %')[0];
    const cell = riskLabel.closest('div[class*="min-w"]');
    expect(cell?.textContent).toContain('—');
    expect(cell?.textContent).not.toContain('0.00%');
  });

  it('shows formatted percentage when riskPct is 0.025', () => {
    const candidate = buildCandidate({
      recommendation: {
        verdict: 'RECOMMENDED',
        reasonsShort: [],
        reasonsDetailed: [],
        risk: { entry: 180, riskAmount: 5, riskPct: 0.025, positionSize: 1000, shares: 10 },
        costs: { commissionEstimate: 1, fxEstimate: 0, slippageEstimate: 0, totalCost: 1 },
        checklist: [],
        education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
      },
    });

    render(<AnalysisDecisionStrip ticker="AAPL" candidate={candidate} />);

    expect(screen.getByText('2.50%')).toBeInTheDocument();
  });
});

describe('AnalysisDecisionStrip — watch button', () => {
  it('renders Watch button when isWatched=false and calls onWatch on click', async () => {
    const onWatch = vi.fn();
    render(
      <AnalysisDecisionStrip
        ticker="BESI.AS"
        isWatched={false}
        isPendingWatch={false}
        onWatch={onWatch}
        onUnwatch={vi.fn()}
      />
    );
    const btn = screen.getByRole('button', { name: /watch/i });
    await userEvent.click(btn);
    expect(onWatch).toHaveBeenCalledOnce();
  });

  it('renders Unwatch button when isWatched=true', () => {
    render(
      <AnalysisDecisionStrip
        ticker="BESI.AS"
        isWatched={true}
        isPendingWatch={false}
        onWatch={vi.fn()}
        onUnwatch={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /unwatch/i })).toBeInTheDocument();
  });
});
describe('AnalysisDecisionStrip — no signal pills row', () => {
  const decisionSummary = {
    symbol: 'BESI.AS',
    action: 'BUY_ON_PULLBACK' as const,
    conviction: 'medium' as const,
    technicalLabel: 'strong' as const,
    fundamentalsLabel: 'strong' as const,
    valuationLabel: 'expensive' as const,
    catalystLabel: 'weak' as const,
    catalystSummary: null,
    catalystSources: [],
    whyNow: '',
    whatToDo: '',
    mainRisk: '',
    tradePlan: { entry: 284, stop: 274.03, target: 303.94, rr: 2 },
    drivers: { positives: [], negatives: [], warnings: [] },
    valuationContext: {
      method: 'not_available' as const,
      summary: '',
      trailingPe: undefined,
      priceToSales: undefined,
      bookValuePerShare: undefined,
      priceToBook: undefined,
      bookToPrice: undefined,
      fairValueLow: undefined,
      fairValueBase: undefined,
      fairValueHigh: undefined,
      premiumDiscountPct: undefined,
    },
  };

  it('does not render Technical / Fundamentals signal pills', () => {
    const candidate = buildCandidate({ entry: 284, stop: 274.03, decisionSummary });
    render(<AnalysisDecisionStrip ticker="BESI.AS" candidate={candidate} />);
    expect(screen.queryByText('Technical: Strong')).not.toBeInTheDocument();
    expect(screen.queryByText('Fundamentals: Strong')).not.toBeInTheDocument();
  });

  it('does not render Setup pill', () => {
    const candidate = buildCandidate({ entry: 284, stop: 274.03, decisionSummary });
    render(<AnalysisDecisionStrip ticker="BESI.AS" candidate={candidate} />);
    expect(screen.queryByText(/Setup:/)).not.toBeInTheDocument();
  });
});
