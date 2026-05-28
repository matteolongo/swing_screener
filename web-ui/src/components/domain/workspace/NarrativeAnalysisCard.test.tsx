import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NarrativeAnalysisCard from './NarrativeAnalysisCard';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';

const baseIntelligence: SymbolIntelligence = {
  symbol: 'AAPL',
  generatedAt: '2026-05-26T10:00:00Z',
  action: 'BUY_NOW',
  conviction: 'high',
  catalystUrgency: 'none',
  summaryLine: 'AAPL broke out on strong volume after earnings beat.',
  narrative: '**What to do:** Enter near $182. **Watch for:** Volume drying up.',
  upcomingEvents: [],
  positionSignal: null,
  sources: [],
};

const baseCandidate: SymbolAnalysisCandidate = {
  ticker: 'AAPL',
  currency: 'USD',
  decisionSummary: {
    symbol: 'AAPL',
    action: 'BUY_NOW',
    conviction: 'high',
    technicalLabel: 'strong',
    fundamentalsLabel: 'neutral',
    valuationLabel: 'fair',
    catalystLabel: 'active',
    whyNow: 'Breakout.',
    whatToDo: 'Buy.',
    mainRisk: 'Market correction.',
    tradePlan: { entry: 182.40, stop: 174.20, target: 204.00, rr: 2.6 },
    valuationContext: { method: 'earnings_multiple' },
    drivers: { positives: [], negatives: [], warnings: ['Watch China exposure'] },
    explanation: undefined,
    catalystSummary: null,
    catalystSources: [],
  },
};

describe('NarrativeAnalysisCard', () => {
  it('renders summaryLine as the lead sentence', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(screen.getByText('AAPL broke out on strong volume after earnings beat.')).toBeInTheDocument();
  });

  it('renders narrative markdown content', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(screen.getByText(/What to do:/)).toBeInTheDocument();
    expect(screen.getByText(/Watch for:/)).toBeInTheDocument();
  });

  it('does not render a duplicate trade plan grid', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    // Trade plan is shown in the workspace header, not inside this card
    expect(screen.queryByText('2.60x')).toBeNull();
  });

  it('signals detail section is collapsed by default', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
  });

  it('renders warnings when present', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    expect(screen.getByText('Watch China exposure')).toBeInTheDocument();
  });

  it('does not render warnings section when no warnings', () => {
    const candidateNoWarnings: SymbolAnalysisCandidate = {
      ...baseCandidate,
      decisionSummary: {
        ...baseCandidate.decisionSummary!,
        drivers: { positives: [], negatives: [], warnings: [] },
      },
    };
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={candidateNoWarnings} />);
    expect(screen.queryByText('Watch China exposure')).toBeNull();
  });

  it('shows mismatch banner when intelligence action differs from candidate decisionSummary action', () => {
    const watchIntelligence: SymbolIntelligence = {
      ...baseIntelligence,
      action: 'WATCH',
    };
    const buyNowCandidate: SymbolAnalysisCandidate = {
      ...baseCandidate,
      decisionSummary: {
        ...baseCandidate.decisionSummary!,
        action: 'BUY_NOW',
      },
    };
    render(<NarrativeAnalysisCard intelligence={watchIntelligence} candidate={buyNowCandidate} />);
    expect(screen.getByText(/AI summary reflects/)).toBeInTheDocument();
  });

  it('does not show mismatch banner when actions match', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    expect(screen.queryByText(/AI summary reflects/)).toBeNull();
  });

  it('renders "Data used by AI" panel with chips when inputsUsed has content', () => {
    const intelligenceWithInputs: SymbolIntelligence = {
      ...baseIntelligence,
      inputsUsed: { trade_plan: { entry: 285, rr: 2.5 } },
    };
    render(<NarrativeAnalysisCard intelligence={intelligenceWithInputs} />);
    expect(screen.getByText('Data used by AI')).toBeInTheDocument();
    expect(screen.getByText('entry:')).toBeInTheDocument();
  });

  it('does not render "Data used by AI" panel when inputsUsed is empty', () => {
    const intelligenceEmptyInputs: SymbolIntelligence = {
      ...baseIntelligence,
      inputsUsed: {},
    };
    render(<NarrativeAnalysisCard intelligence={intelligenceEmptyInputs} />);
    expect(screen.queryByText('Data used by AI')).toBeNull();
  });

  it('renders confidenceNotes from explanation when present, not drivers.warnings', () => {
    const candidateWithNotes: SymbolAnalysisCandidate = {
      ...baseCandidate,
      decisionSummary: {
        ...baseCandidate.decisionSummary!,
        drivers: { positives: [], negatives: [], warnings: ['Should not appear'] },
        explanation: {
          summaryLine: 'Test summary',
          whyItQualified: ['Qualified reason'],
          whyNow: ['Timing reason'],
          mainRisks: ['Risk item'],
          whatInvalidatesIt: ['Invalidation scenario'],
          nextBestAction: 'Next action',
          confidenceNotes: ['Confidence note shown'],
        },
      },
    };
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={candidateWithNotes} />);
    expect(screen.getByText('Confidence note shown')).toBeInTheDocument();
    expect(screen.queryByText('Should not appear')).toBeNull();
  });
});
