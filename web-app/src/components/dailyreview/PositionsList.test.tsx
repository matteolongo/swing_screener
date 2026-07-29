import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PositionsList from './PositionsList';
import type { Position } from '../../types/api';

const longPosition: Position = {
  position_id: 'p1', ticker: 'AAPL', direction: 'long', entry_price: 170,
  current_price: 180, shares: 50, market_value: 9000, unrealized_pl: 500,
  rr_to_target: 2.5, distance_to_stop: 5, trail_method: 'SMA20',
  last_exhaustion_score: 2, last_exhaustion_label: 'Low', target_price: 200,
};

const shortPosition: Position = {
  position_id: 'p2', ticker: 'MSFT', direction: 'short', entry_price: 420,
  current_price: 410, shares: 20, market_value: 8200, unrealized_pl: 200,
  rr_to_target: 1.8, distance_to_stop: -1, trail_method: 'ATR',
  last_exhaustion_score: 5, last_exhaustion_label: 'Medium', target_price: 390,
};

describe('PositionsList', () => {
  it('renders table headers', () => {
    render(<PositionsList positions={[longPosition]} isLoading={false} />);

    expect(screen.getByText('Ticker')).toBeInTheDocument();
    expect(screen.getByText('Dir')).toBeInTheDocument();
    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('P&L (R)')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText('Trail')).toBeInTheDocument();
    expect(screen.getByText('Exh')).toBeInTheDocument();
  });

  it('renders position ticker', () => {
    render(<PositionsList positions={[longPosition]} isLoading={false} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('renders LONG direction badge', () => {
    render(<PositionsList positions={[longPosition]} isLoading={false} />);

    const badge = screen.getByText('LONG');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-success');
  });

  it('renders SHORT direction badge', () => {
    render(<PositionsList positions={[shortPosition]} isLoading={false} />);

    const badge = screen.getByText('SHORT');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-danger');
  });

  it('colors positive P&L green', () => {
    render(<PositionsList positions={[longPosition]} isLoading={false} />);

    const plCell = screen.getByText('+0.83');
    expect(plCell.className).toContain('text-success');
  });

  it('colors negative P&L red', () => {
    const losingPosition: Position = {
      ...longPosition, current_price: 165, ticker: 'LOSS',
    };
    render(<PositionsList positions={[losingPosition]} isLoading={false} />);

    const plCell = screen.getByText('-0.42');
    expect(plCell.className).toContain('text-danger');
  });

  it('shows Active stop status for active position', () => {
    render(<PositionsList positions={[longPosition]} isLoading={false} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Hit stop status for triggered position', () => {
    render(<PositionsList positions={[shortPosition]} isLoading={false} />);

    expect(screen.getByText('Hit')).toBeInTheDocument();
  });

  it('renders trail method badge', () => {
    render(<PositionsList positions={[longPosition]} isLoading={false} />);

    expect(screen.getByText('SMA20')).toBeInTheDocument();
  });

  it('renders exhaustion score', () => {
    render(<PositionsList positions={[longPosition]} isLoading={false} />);

    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('shows empty state when no positions', () => {
    render(<PositionsList positions={[]} isLoading={false} />);

    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading', () => {
    const { container } = render(<PositionsList positions={[]} isLoading={true} />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
