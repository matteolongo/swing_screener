import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThesisView from './ThesisView';
import type { AIAnalysis } from '../../types/api';

const baseAnalysis: AIAnalysis = {
  ticker: 'AAPL',
  generated_at: '2025-01-15T20:00:00Z',
  thesis: 'Test',
  entry: 180,
  stop: 170,
  target: 200,
  rr: 2.5,
};

describe('ThesisView', () => {
  it('shows Unresolved badge when no thesis_status', () => {
    render(<ThesisView analysis={baseAnalysis} />);
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
  });

  it('shows Confirmed badge', () => {
    render(<ThesisView analysis={{ ...baseAnalysis, thesis_status: 'confirmed' }} />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows Contradicted badge', () => {
    render(<ThesisView analysis={{ ...baseAnalysis, thesis_status: 'contradicted' }} />);
    expect(screen.getByText('Contradicted')).toBeInTheDocument();
  });

  it('renders what_played_out text', () => {
    render(<ThesisView analysis={{ ...baseAnalysis, what_played_out: 'Price reached target in 3 days' }} />);
    expect(screen.getByText('Price reached target in 3 days')).toBeInTheDocument();
  });

  it('renders thesis_delta text', () => {
    render(<ThesisView analysis={{ ...baseAnalysis, thesis_delta: 'Stop loss tightened to 175' }} />);
    expect(screen.getByText('Stop loss tightened to 175')).toBeInTheDocument();
  });

  it('renders predictions with direction arrows', () => {
    const a = {
      ...baseAnalysis,
      predictions: {
        direction: 'up', reason: 'Bullish flag forming', target: 210,
      },
    };
    render(<ThesisView analysis={a} />);
    expect(screen.getByText('Bullish flag forming')).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('renders down prediction arrow', () => {
    const a = {
      ...baseAnalysis,
      predictions: [{ direction: 'down', reason: 'Resistance at 200', target: 190 }] as unknown as Record<string, unknown>,
    };
    render(<ThesisView analysis={a} />);
    expect(screen.getByText('↓')).toBeInTheDocument();
  });
});
