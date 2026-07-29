import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderTicket from './OrderTicket';
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

describe('OrderTicket', () => {
  it('renders readonly ticker and side', () => {
    render(<OrderTicket analysis={mockAnalysis} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('renders order type toggle buttons', () => {
    render(<OrderTicket analysis={mockAnalysis} />);
    expect(screen.getByText('BUY STOP')).toBeInTheDocument();
    expect(screen.getByText('BUY LIMIT')).toBeInTheDocument();
  });

  it('renders editable input fields', () => {
    render(<OrderTicket analysis={mockAnalysis} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBe(4);
  });

  it('entering quantity updates computed fields', () => {
    render(<OrderTicket analysis={mockAnalysis} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });

  it('calculates 1R correctly: entry 150, stop 140 => 1R = 10', () => {
    const a = { ...mockAnalysis, entry: 150, stop: 140, target: 160 };
    render(<OrderTicket analysis={a} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[1]).toHaveValue(150);
    expect(inputs[2]).toHaveValue(140);
  });

  it('calculates R:R 1.0 when entry 150, stop 140, target 160', () => {
    const a = { ...mockAnalysis, entry: 150, stop: 140, target: 160 };
    render(<OrderTicket analysis={a} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });

  it('shows fee gate FAIL when commission exceeds 20% of risk', () => {
    const a = { ...mockAnalysis, entry: 100, stop: 99, target: 110 };
    render(<OrderTicket analysis={a} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });

  it('shows fee gate PASS when commission is within limit', () => {
    const a = { ...mockAnalysis, entry: 10, stop: 5, target: 15 };
    render(<OrderTicket analysis={a} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    expect(screen.getByText('PASS')).toBeInTheDocument();
  });

  it('copy to clipboard formats correctly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<OrderTicket analysis={mockAnalysis} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '50' } });
    fireEvent.click(screen.getByText('Copy to clipboard'));
    expect(writeText).toHaveBeenCalledWith(
      'AAPL | BUY | 50 shares @ 180.00 | Stop: 170.00 | Target: 200.00 | R:R 2.00 | Risk: $500 | PASS',
    );
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('reset reverts to analysis defaults', () => {
    render(<OrderTicket analysis={mockAnalysis} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '999' } });
    fireEvent.click(screen.getByText('Reset'));
    expect(inputs[1]).toHaveValue(180);
  });

  it('save draft persists to store', () => {
    render(<OrderTicket analysis={mockAnalysis} />);
    fireEvent.click(screen.getByText('Save draft'));
    const drafts = useAIStore.getState().drafts;
    expect(drafts['AAPL']).toBeDefined();
    expect(drafts['AAPL'].ticker).toBe('AAPL');
  });
});
