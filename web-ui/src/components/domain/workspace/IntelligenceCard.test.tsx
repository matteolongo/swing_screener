import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntelligenceCard from './IntelligenceCard';
import type {
  SymbolIntelligence,
  IntelligenceEvent,
  PositionOutlook,
  PositionSignal,
} from '@/features/intelligence/types';

const baseIntel: SymbolIntelligence = {
  symbol: 'APAM',
  generatedAt: '2026-05-23T10:00:00Z',
  action: 'BUY_NOW',
  conviction: 'high',
  catalystUrgency: 'none',
  summaryLine: 'Cyclical recovery with improving EBITDA.',
  narrative: 'Aperam Q1 2026 beat consensus on EBITDA. Margins expanding into H2.',
  upcomingEvents: [],
  positionSignal: null,
  positionOutlook: null,
  sources: ['https://aperam.com/q1-2026'],
};

describe('IntelligenceCard', () => {
  it('shows sources count and URL when expanded', async () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    const summary = screen.getByText(/Sources \(1\)/);
    expect(summary).toBeInTheDocument();
    await userEvent.click(summary);
    expect(screen.getByText('https://aperam.com/q1-2026')).toBeInTheDocument();
  });

  it('renders nothing for empty sources', () => {
    render(<IntelligenceCard intelligence={{ ...baseIntel, sources: [] }} />);
    expect(screen.queryByText(/Sources/)).toBeNull();
  });

  it('does not render fields moved to the overview narrative card', () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    expect(screen.queryByText('BUY_NOW')).toBeNull();
    expect(screen.queryByText('high')).toBeNull();
    expect(screen.queryByText('Cyclical recovery with improving EBITDA.')).toBeNull();
    expect(screen.queryByText('Aperam Q1 2026 beat consensus on EBITDA. Margins expanding into H2.')).toBeNull();
  });

  it('does not render an empty shell when there are no remaining detail sections', () => {
    const { container } = render(<IntelligenceCard intelligence={{ ...baseIntel, sources: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  const baseIntelExtended = {
    ...baseIntel,
    catalystUrgency: 'high' as const,
    upcomingEvents: [
      {
        type: 'earnings' as const,
        date: '2026-05-28',
        direction: 'bullish' as const,
        summary: 'Q2 earnings expected to beat consensus.',
      },
    ] satisfies IntelligenceEvent[],
    positionSignal: { action: 'HOLD' as const, reason: 'Thesis intact.' } satisfies PositionSignal,
    positionOutlook: {
      expectedHoldingPeriod: '1-2_weeks',
      holdUntil: 'Hold while price remains above SMA20.',
      nextReviewTrigger: 'Reassess after earnings.',
      thesisStatus: 'intact',
      invalidationSignals: ['Close below SMA20', 'Catalyst fails to confirm'],
      profitManagement: 'trail_stop',
      opportunityCost: 'medium',
      confidenceDecay: 'Confidence fades if price stalls for two weeks.',
    } satisfies PositionOutlook,
  };

  it('renders catalyst_urgency badge when high', () => {
    render(<IntelligenceCard intelligence={baseIntelExtended} />);
    expect(screen.getByText('High urgency')).toBeInTheDocument();
  });

  it('does not render urgency badge when none', () => {
    render(<IntelligenceCard intelligence={{ ...baseIntelExtended, catalystUrgency: 'none' }} />);
    expect(screen.queryByText(/urgency/i)).toBeNull();
  });

  it('renders upcoming events list', () => {
    render(<IntelligenceCard intelligence={baseIntelExtended} />);
    expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
    expect(screen.getByText('Q2 earnings expected to beat consensus.')).toBeInTheDocument();
  });

  it('does not render upcoming events section when empty', () => {
    render(<IntelligenceCard intelligence={{ ...baseIntelExtended, upcomingEvents: [] }} />);
    expect(screen.queryByText('Upcoming Events')).toBeNull();
  });

  it('renders position signal card when present', () => {
    render(<IntelligenceCard intelligence={baseIntelExtended} />);
    expect(screen.getByText('Hold')).toBeInTheDocument();
    expect(screen.getByText('Thesis intact.')).toBeInTheDocument();
  });

  it('does not render position signal when null', () => {
    render(<IntelligenceCard intelligence={{ ...baseIntelExtended, positionSignal: null }} />);
    expect(screen.queryByText('Hold')).toBeNull();
    expect(screen.queryByText('Trim')).toBeNull();
    expect(screen.queryByText('Exit')).toBeNull();
  });

  it('renders position outlook when present', () => {
    render(<IntelligenceCard intelligence={baseIntelExtended} />);
    expect(screen.getByText('Position Outlook')).toBeInTheDocument();
    expect(screen.getByText('1-2 weeks')).toBeInTheDocument();
    expect(screen.getByText('Hold while price remains above SMA20.')).toBeInTheDocument();
    expect(screen.getByText('Reassess after earnings.')).toBeInTheDocument();
    expect(screen.getByText('Close below SMA20')).toBeInTheDocument();
  });
});
