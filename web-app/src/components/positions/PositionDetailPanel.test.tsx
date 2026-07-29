import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PositionDetailPanel from './PositionDetailPanel';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { useAIStore } from '../../store/useAIStore';
import { useAppStore } from '../../store/useAppStore';
import type { Position } from '../../types/api';

const mockPosition: Position = {
  position_id: 'pos-1',
  ticker: 'AAPL',
  direction: 'long',
  entry_price: 170,
  current_price: 180,
  shares: 50,
  market_value: 9000,
  unrealized_pl: 500,
  rr_to_target: 2.5,
  distance_to_stop: 5,
  trail_method: 'SMA20',
  trail_level: 175,
  last_exhaustion_score: 2,
  last_exhaustion_label: 'Low',
  target_price: 200,
};

const shortPosition: Position = {
  ...mockPosition,
  position_id: 'pos-2',
  ticker: 'MSFT',
  direction: 'short',
  entry_price: 420,
  current_price: 410,
  market_value: 8200,
  unrealized_pl: 200,
  rr_to_target: 1.8,
  distance_to_stop: -1,
  trail_method: 'ATR',
  last_exhaustion_score: 5,
  target_price: 390,
};

beforeEach(() => {
  usePortfolioStore.setState({
    positions: [mockPosition, shortPosition],
    selectedPositionId: null,
    dailyReview: null,
    isLoading: false,
  });
  useAIStore.setState({
    analysisData: {},
    activeSymbol: null,
    chatHistory: {},
    drafts: {},
  });
  useAppStore.setState({
    activeTab: 'screener',
    mode: 'eod',
    alerts: [],
    accountSize: 50000,
  });
});

describe('PositionDetailPanel', () => {
  it('renders nothing when positionId is null', () => {
    const { container } = render(
      <PositionDetailPanel positionId={null} onClose={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders position not found when id does not match', () => {
    render(<PositionDetailPanel positionId="nonexistent" onClose={() => {}} />);
    expect(screen.getByText('Position not found')).toBeInTheDocument();
  });

  it('renders ticker in header', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('renders LONG direction badge', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    const badge = screen.getByText('LONG');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-success');
  });

  it('renders SHORT direction badge', () => {
    render(<PositionDetailPanel positionId="pos-2" onClose={() => {}} />);
    const badge = screen.getByText('SHORT');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-danger');
  });

  it('renders P&L in header and metrics', () => {
    const { container } = render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    const plMatches = container.textContent!.match(/\+\$500\.00/g);
    expect(plMatches).toHaveLength(2);
  });

  it('renders plan section with entry, stop, target, shares', () => {
    const { container } = render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(container.textContent).toContain('$170.00');
    expect(container.textContent).toContain('$200.00');
    expect(container.textContent).toContain('50');
  });

  it('renders current metrics section', () => {
    const { container } = render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('Current Metrics')).toBeInTheDocument();
    expect(container.textContent).toContain('$9000.00');
  });

  it('renders trail status section', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('Trail')).toBeInTheDocument();
    expect(screen.getByText('SMA20')).toBeInTheDocument();
  });

  it('renders exhaustion badge section', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('Exhaustion')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders stop preview section', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('Stop Preview')).toBeInTheDocument();
  });

  it('renders View Analysis button', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('View Analysis')).toBeInTheDocument();
  });

  it('View Analysis navigates to AI tab', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    fireEvent.click(screen.getByText('View Analysis'));
    expect(useAIStore.getState().activeSymbol).toBe('AAPL');
    expect(useAppStore.getState().activeTab).toBe('ai');
  });

  it('renders close controls', () => {
    render(<PositionDetailPanel positionId="pos-1" onClose={() => {}} />);
    expect(screen.getByText('Execute manually in DeGiro')).toBeInTheDocument();
    expect(screen.getByText('Close Position')).toBeInTheDocument();
    expect(screen.getByText('Partial Close')).toBeInTheDocument();
  });

  it('distToStopPct shows negative value in red for hit stop', () => {
    render(<PositionDetailPanel positionId="pos-2" onClose={() => {}} />);
    const el = screen.getByText('-1.0%');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('text-danger');
  });
});
