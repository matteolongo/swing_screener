import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IntelligencePanel from './IntelligencePanel';
import type { AIAnalysis } from '@/types/api';

const mockAnalysis: AIAnalysis = {
  ticker: 'AAPL',
  generated_at: '2025-07-28T20:00:00Z',
  thesis: 'Strong momentum breakout with volume confirmation on the daily chart',
  entry: 180,
  stop: 170,
  target: 200,
  rr: 2.5,
  evidence_ledger: {
    'Trendline Analysis': { excerpt: 'Bullish flag on daily', verdict: 'supportive' },
    'Volume Profile': { excerpt: 'Above average volume', verdict: 'supportive' },
  },
  classified_catalysts: {
    catalyst_1: { type: 'earnings', description: 'Beat estimates by 5%', citation: 'Q3 report' },
  },
  predictions: {
    pred_1: { direction: 'up', reason: 'Technical breakout', reference: 'daily chart' },
  },
  pre_open_outlook: 'Pre-market up 1.2%, bullish bias',
  news: [
    { headline: 'Apple reports strong earnings', sentiment: 'positive', source: 'Reuters', date: '2025-07-28' },
    { headline: 'Market rally broadens', sentiment: 'neutral', source: 'Bloomberg', date: '2025-07-28' },
  ],
};

describe('IntelligencePanel', () => {
  it('shows placeholder when analysis is null and not loading', () => {
    render(<IntelligencePanel analysis={null} isLoading={false} />);
    expect(screen.getByText('Select a symbol to view analysis')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    const { container } = render(<IntelligencePanel analysis={null} isLoading={true} />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders thesis section', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('Strong momentum breakout with volume confirmation on the daily chart')).toBeInTheDocument();
  });

  it('renders trade plan with entry, stop, target', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('$180.00')).toBeInTheDocument();
    expect(screen.getByText('$170.00')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  it('renders R:R value', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('2.50')).toBeInTheDocument();
  });

  it('renders evidence ledger entries', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('Trendline Analysis')).toBeInTheDocument();
    expect(screen.getByText('Volume Profile')).toBeInTheDocument();
  });

  it('renders classified catalysts', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('Beat estimates by 5%')).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes('Q3 report'))).toBeInTheDocument();
  });

  it('renders predictions', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('↑')).toBeInTheDocument();
    expect(screen.getByText('Technical breakout')).toBeInTheDocument();
  });

  it('renders pre-open outlook banner', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('Pre-market up 1.2%, bullish bias')).toBeInTheDocument();
  });

  it('renders news feed with sentiment tags', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('Apple reports strong earnings')).toBeInTheDocument();
    expect(screen.getByText('Market rally broadens')).toBeInTheDocument();
    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(screen.getByText('neutral')).toBeInTheDocument();
  });

  it('renders section headers', () => {
    render(<IntelligencePanel analysis={mockAnalysis} isLoading={false} />);
    expect(screen.getByText('Thesis')).toBeInTheDocument();
    expect(screen.getByText('Trade Plan')).toBeInTheDocument();
    expect(screen.getByText('Evidence Ledger')).toBeInTheDocument();
    expect(screen.getByText('Classified Catalysts')).toBeInTheDocument();
    expect(screen.getByText('Predictions')).toBeInTheDocument();
    expect(screen.getByText('News Feed')).toBeInTheDocument();
  });
});
