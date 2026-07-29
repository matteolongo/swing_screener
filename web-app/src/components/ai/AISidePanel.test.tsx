import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AISidePanel from './AISidePanel';
import { useAIStore } from '../../store/useAIStore';
import type { AIAnalysis } from '../../types/api';

const mockAnalysis: AIAnalysis = {
  ticker: 'AAPL',
  generated_at: '2025-01-15T20:00:00Z',
  thesis: 'Strong momentum breakout with volume confirmation',
  entry: 180,
  stop: 170,
  target: 200,
  rr: 2.5,
};

beforeEach(() => {
  useAIStore.setState({ analysisData: {}, activeSymbol: null, chatHistory: {}, drafts: {} });
});

describe('AISidePanel', () => {
  it('renders nothing when activeSymbol is null', () => {
    const { container } = render(<AISidePanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders panel when activeSymbol is set', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    render(<AISidePanel />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('shows sub-tab buttons', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    render(<AISidePanel />);
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Thesis')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });

  it('shows loading when no analysis data', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    render(<AISidePanel />);
    expect(screen.getByText('Loading analysis...')).toBeInTheDocument();
  });

  it('renders AnalysisView when analysis exists and sub-tab is Analysis', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    useAIStore.getState().setAnalysis('AAPL', mockAnalysis);
    render(<AISidePanel />);
    expect(screen.getByText('Strong momentum breakout with volume confirmation')).toBeInTheDocument();
  });

  it('switches to Thesis sub-tab on click', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    useAIStore.getState().setAnalysis('AAPL', mockAnalysis);
    render(<AISidePanel />);
    const buttons = screen.getAllByText('Thesis');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('switches to Plan sub-tab on click', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    useAIStore.getState().setAnalysis('AAPL', mockAnalysis);
    render(<AISidePanel />);
    fireEvent.click(screen.getByText('Plan'));
    expect(screen.getByText('BUY STOP')).toBeInTheDocument();
  });

  it('closes panel when close button clicked', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    render(<AISidePanel />);
    const closeBtn = document.querySelector('button svg');
    if (closeBtn) fireEvent.click(closeBtn.closest('button')!);
    expect(useAIStore.getState().activeSymbol).toBeNull();
  });
});
