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

  it('renders trade plan tiles when candidate has decisionSummary', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} currency="USD" />);
    expect(screen.getByText('$182.40')).toBeInTheDocument();
    expect(screen.getByText('$174.20')).toBeInTheDocument();
    expect(screen.getByText('$204.00')).toBeInTheDocument();
    expect(screen.getByText('2.60x')).toBeInTheDocument();
  });

  it('does not render trade plan when no candidate', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(screen.queryByText('$182.40')).toBeNull();
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
});
