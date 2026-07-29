import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnalysisView from './AnalysisView';
import type { AIAnalysis } from '../../types/api';

const baseAnalysis: AIAnalysis = {
  ticker: 'AAPL',
  generated_at: '2025-01-15T20:00:00Z',
  thesis: 'Strong momentum breakout with volume confirmation above prior resistance.',
  entry: 180,
  stop: 170,
  target: 200,
  rr: 2.5,
};

describe('AnalysisView', () => {
  it('renders entry, stop, target', () => {
    render(<AnalysisView analysis={baseAnalysis} />);
    expect(screen.getByText('$180.00')).toBeInTheDocument();
    expect(screen.getByText('$170.00')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  it('renders R:R value', () => {
    render(<AnalysisView analysis={baseAnalysis} />);
    expect(screen.getByText('2.50')).toBeInTheDocument();
  });

  it('renders Risk $', () => {
    render(<AnalysisView analysis={baseAnalysis} />);
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });

  it('renders thesis paragraph', () => {
    render(<AnalysisView analysis={baseAnalysis} />);
    expect(screen.getByText('Strong momentum breakout with volume confirmation above prior resistance.')).toBeInTheDocument();
  });

  it('renders pre_open_outlook in amber banner', () => {
    const a = { ...baseAnalysis, pre_open_outlook: 'Gap up expected +2%' };
    render(<AnalysisView analysis={a} />);
    expect(screen.getByText('Gap up expected +2%')).toBeInTheDocument();
  });

  it('renders evidence entries', () => {
    const a = {
      ...baseAnalysis,
      evidence_ledger: {
        'Price Action': 'Strong close above resistance',
        'Volume': '2x average volume',
      },
    };
    render(<AnalysisView analysis={a} />);
    expect(screen.getByText('Price Action')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
  });

  it('renders citations', () => {
    const a = {
      ...baseAnalysis,
      source_citations: [
        { source: 'Reuters', excerpt: 'Apple reports record quarter' },
      ],
    };
    render(<AnalysisView analysis={a} />);
    expect(screen.getByText('Reuters')).toBeInTheDocument();
    expect(screen.getByText(/Apple reports record quarter/)).toBeInTheDocument();
  });

  it('renders news items with sentiment', () => {
    const a = {
      ...baseAnalysis,
      news: [
        { headline: 'AAPL hits new high', sentiment: 'positive', source: 'Bloomberg' },
        { headline: 'Supply chain concerns', sentiment: 'negative', source: 'Reuters' },
      ],
    };
    render(<AnalysisView analysis={a} />);
    expect(screen.getByText('AAPL hits new high')).toBeInTheDocument();
    expect(screen.getByText('Supply chain concerns')).toBeInTheDocument();
  });

  it('shows only last 3 news items', () => {
    const a = {
      ...baseAnalysis,
      news: [
        { headline: 'News 1', sentiment: 'neutral' },
        { headline: 'News 2', sentiment: 'positive' },
        { headline: 'News 3', sentiment: 'negative' },
        { headline: 'News 4', sentiment: 'positive' },
      ],
    };
    render(<AnalysisView analysis={a} />);
    expect(screen.queryByText('News 1')).not.toBeInTheDocument();
    expect(screen.getByText('News 2')).toBeInTheDocument();
    expect(screen.getByText('News 3')).toBeInTheDocument();
    expect(screen.getByText('News 4')).toBeInTheDocument();
  });
});
