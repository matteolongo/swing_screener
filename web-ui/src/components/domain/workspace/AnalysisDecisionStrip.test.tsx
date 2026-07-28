import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { t } from '@/i18n/t';

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
    const cell = toTargetLabel.closest('tr');
    expect(cell?.textContent).toContain('—');
  });
});

describe('AnalysisDecisionStrip — order preparation authority', () => {
  const buyNowSummary = {
    symbol: 'AAPL', action: 'BUY_NOW' as const, conviction: 'high' as const,
    technicalLabel: 'strong' as const, fundamentalsLabel: 'strong' as const,
    valuationLabel: 'fair' as const, catalystLabel: 'active' as const,
    whyNow: '', whatToDo: '', mainRisk: '',
    tradePlan: { entry: 200, stop: 190, target: 220, rr: 2 },
    drivers: { positives: [], negatives: [], warnings: [] },
    valuationContext: { method: 'not_available' as const, summary: '' },
  };

  it('does not expose Prepare order for a BUY_NOW opinion without ready workflow status', () => {
    render(
      <AnalysisDecisionStrip
        ticker="AAPL"
        candidate={buildCandidate({
          decisionSummary: buyNowSummary,
          recommendation: { workflowStatus: 'no_setup', nextStep: { code: 'observe' } } as any,
        })}
        onPrepareOrder={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /prepare order/i })).not.toBeInTheDocument();
  });

  it('suppresses a conflicting BUY_NOW opinion when the canonical workflow says no setup', () => {
    const { container } = render(
      <AnalysisDecisionStrip
        ticker="AAPL"
        candidate={buildCandidate({
          decisionSummary: buyNowSummary,
          recommendation: { workflowStatus: 'no_setup', nextStep: { code: 'observe' } } as any,
        })}
        onPrepareOrder={vi.fn()}
      />,
    );

    expect(screen.getByText(t('recommendation.workflow.status.noSetup'))).toBeVisible();
    expect(screen.getByText(t('recommendation.workflow.nextStep.observe'))).toBeVisible();
    expect(screen.queryByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'))).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /prepare order/i })).not.toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveClass('sticky');
  });

  it('exposes Prepare order for a canonical ready candidate', () => {
    render(
      <AnalysisDecisionStrip
        ticker="AAPL"
        candidate={buildCandidate({
          decisionSummary: buyNowSummary,
          recommendation: { workflowStatus: 'ready', nextStep: { code: 'review_order' } } as any,
        })}
        onPrepareOrder={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /prepare order/i })).toBeInTheDocument();
  });

  it('uses the canonical ready workflow for the CTA and primary next step even when the analysis says wait', () => {
    const readyRecommendation = {
      verdict: 'RECOMMENDED' as const,
      reasonsShort: [],
      reasonsDetailed: [],
      risk: { entry: 200, riskAmount: 10, riskPct: 0.05, positionSize: 200, shares: 1 },
      costs: { commissionEstimate: 0, fxEstimate: 0, slippageEstimate: 0, totalCost: 0 },
      checklist: [],
      education: { commonBiasWarning: '', whatToLearn: '', whatWouldMakeValid: [] },
      workflowStatus: 'ready' as const,
      nextStep: { code: 'review_order' as const },
    };
    const waitSummary = { ...buyNowSummary, action: 'WAIT_FOR_BREAKOUT' as const, whatToDo: 'Wait for a breakout.' };

    render(
      <AnalysisDecisionStrip
        ticker="AAPL"
        candidate={buildCandidate({ decisionSummary: waitSummary, recommendation: readyRecommendation })}
        onPrepareOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('Ready for order review')).toBeInTheDocument();
    expect(screen.getByText('Review the proposed order')).toBeInTheDocument();
    expect(screen.queryByText('Wait for a breakout.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prepare order/i })).toBeInTheDocument();
  });
});

describe('AnalysisDecisionStrip — workflow status presentation', () => {
  it('uses the canonical review tone instead of a success badge', () => {
    render(
      <AnalysisDecisionStrip
        ticker="AAPL"
        candidate={buildCandidate({
          recommendation: { workflowStatus: 'needs_review', nextStep: { code: 'refresh_data' } } as any,
        })}
      />,
    );

    expect(screen.getByText(t('recommendation.workflow.status.needsReview'))).toHaveClass('text-danger');
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
        workflowStatus: 'ready',
        nextStep: { code: 'review_order' },
      },
    });

    render(<AnalysisDecisionStrip ticker="AAPL" candidate={candidate} />);

    const riskLabel = screen.getAllByText('Risk %')[0];
    const cell = riskLabel.closest('tr');
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
        workflowStatus: 'ready',
        nextStep: { code: 'review_order' },
      },
    });

    render(<AnalysisDecisionStrip ticker="AAPL" candidate={candidate} />);

    expect(screen.getByText('2.50%')).toBeInTheDocument();
  });
});

describe('AnalysisDecisionStrip — planned pullback entry', () => {
  it('uses the suggested order price as planned entry and shows close as secondary context', () => {
    const decisionSummary = {
      symbol: 'BESI.AS',
      action: 'BUY_ON_PULLBACK' as const,
      conviction: 'medium' as const,
      technicalLabel: 'strong' as const,
      fundamentalsLabel: 'strong' as const,
      valuationLabel: 'expensive' as const,
      catalystLabel: 'weak' as const,
      whyNow: '',
      whatToDo: '',
      mainRisk: '',
      tradePlan: { entry: 287.6, stop: 277.37, target: 308.06, rr: 2 },
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
    const candidate = buildCandidate({
      ticker: 'BESI.AS',
      currency: 'EUR',
      close: 287.6,
      entry: 287.6,
      stop: 277.37,
      suggestedOrderType: 'BUY_LIMIT',
      suggestedOrderPrice: 285.04,
      decisionSummary,
    });

    render(<AnalysisDecisionStrip ticker="BESI.AS" candidate={candidate} />);

    const entryLabel = screen.getByText('Planned entry');
    const entryCell = entryLabel.closest('tr');
    expect(entryCell?.textContent).toContain('€285.04');
    expect(entryCell?.textContent).toContain('Close €287.60');
    expect(entryCell?.textContent).not.toContain('Entry (close)');

    const oneRLabel = screen.getByText('1R');
    const oneRCell = oneRLabel.closest('tr');
    expect(oneRCell?.textContent).toContain('€7.67');
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
describe('AnalysisDecisionStrip — trade-plan table', () => {
  it('groups the execution metrics and invalidation in one named table', () => {
    render(<AnalysisDecisionStrip ticker="BESI.AS" />);
    expect(screen.getByRole('table', { name: t('workspacePage.overview.tradePlan') })).toBeVisible();
  });

  it('renders the four core execution fields', () => {
    render(<AnalysisDecisionStrip ticker="BESI.AS" />);
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionSummary.tradePlan.entryClose'))).toBeVisible();
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionSummary.tradePlan.stop'))).toBeVisible();
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionSummary.tradePlan.target'))).toBeVisible();
    expect(screen.getByText(t('workspacePage.overview.invalidation'))).toBeVisible();
  });
});

describe('AnalysisDecisionStrip — source chips', () => {
  it('renders compact provider and status chips from candidate data sources', () => {
    const candidate = buildCandidate({
      dataSourceSummary: {
        marketData: {
          provider: 'yfinance',
          status: 'ok',
          qualityScore: 0.65,
          warnings: [],
        },
        fundamentals: {
          provider: 'sec_edgar',
          status: 'degraded',
          qualityScore: 0.72,
          warnings: ['stale'],
        },
      },
    });

    render(<AnalysisDecisionStrip ticker="AAPL" candidate={candidate} />);

    expect(screen.getByText('Market: yfinance (ok)')).toBeInTheDocument();
    expect(screen.getByText('Fundamentals: sec_edgar (degraded)')).toBeInTheDocument();
  });
});

describe('AnalysisDecisionStrip held position', () => {
  it('shows the real filled entry, not the fresh-setup close', () => {
    const position = {
      positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3,
      targetPrice: 498.26, shares: 1, perShareRisk: 36.74, entryValue: 383.04,
    } as any;

    // Candidate carries a fresh-setup trade plan whose entry equals today's close.
    const candidate = buildCandidate({
      ticker: 'LRCX',
      currency: 'USD',
      decisionSummary: { symbol: 'LRCX', action: 'MANAGE_ONLY' as const, conviction: 'low' as const, technicalLabel: 'neutral' as const, fundamentalsLabel: 'neutral' as const, valuationLabel: 'fair' as const, catalystLabel: 'weak' as const, whyNow: '', whatToDo: '', mainRisk: '', tradePlan: { entry: 401.82, stop: 353.6, target: 498.26, rr: 2 }, drivers: { positives: [], negatives: [], warnings: [] }, valuationContext: { method: 'not_available' as const, summary: '', trailingPe: undefined, priceToSales: undefined, bookValuePerShare: undefined, priceToBook: undefined, bookToPrice: undefined, fairValueLow: undefined, fairValueBase: undefined, fairValueHigh: undefined, premiumDiscountPct: undefined } },
    });

    render(<AnalysisDecisionStrip ticker="LRCX" candidate={candidate} position={position} />);
    expect(screen.getByText('$383.04')).toBeInTheDocument();
    expect(screen.queryByText('$401.82')).not.toBeInTheDocument();
  });
});
