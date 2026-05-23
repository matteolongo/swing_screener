import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntelligenceCard from './IntelligenceCard';
import type { SymbolIntelligence } from '@/features/intelligence/types';

const baseIntel: SymbolIntelligence = {
  symbol: 'APAM',
  generatedAt: '2026-05-23T10:00:00Z',
  action: 'BUY_NOW',
  conviction: 'high',
  catalystUrgency: 'none',
  summaryLine: 'Cyclical recovery with improving EBITDA.',
  narrative: "## Why it's moving\nAperam Q1 2026 beat.",
  upcomingEvents: [],
  positionSignal: null,
  sources: ['https://aperam.com/q1-2026'],
};

describe('IntelligenceCard', () => {
  it('renders action and conviction badges', () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    expect(screen.getByText('Buy Now')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders the summary line', () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    expect(screen.getByText('Cyclical recovery with improving EBITDA.')).toBeInTheDocument();
  });

  it('renders the narrative text', () => {
    render(<IntelligenceCard intelligence={baseIntel} />);
    expect(screen.getByText(/Why it's moving/)).toBeInTheDocument();
  });

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
});
