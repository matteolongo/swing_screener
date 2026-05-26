import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';

function buildCandidate(overrides: Partial<SymbolAnalysisCandidate> = {}): SymbolAnalysisCandidate {
  return {
    ticker: 'AAPL',
    currency: 'USD',
    ...overrides,
  };
}

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
