import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanView from './PlanView';
import { useAIStore } from '../../store/useAIStore';
import { useAppStore } from '../../store/useAppStore';
import type { AIAnalysis } from '../../types/api';

const mockAnalysis: AIAnalysis = {
  ticker: 'AAPL',
  generated_at: '2025-01-15T20:00:00Z',
  thesis: 'Test',
  entry: 180,
  stop: 170,
  target: 200,
  rr: 2.5,
};

beforeEach(() => {
  useAIStore.setState({ analysisData: {}, activeSymbol: null, chatHistory: {}, drafts: {} });
  useAppStore.setState({ accountSize: 50000, activeTab: 'screener', mode: 'eod', alerts: [] });
});

describe('PlanView', () => {
  it('renders OrderTicket with analysis data', () => {
    render(<PlanView analysis={mockAnalysis} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<PlanView analysis={mockAnalysis} />);
    expect(screen.getByText(/Review and adjust/)).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<PlanView analysis={mockAnalysis} />);
    expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
    expect(screen.getByText('Save draft')).toBeInTheDocument();
  });
});
