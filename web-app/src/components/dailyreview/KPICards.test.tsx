import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPICards from './KPICards';
import type { KPI, Position, CandidateRow, AlertItem } from '../../types/api';

const basePositions: Position[] = [
  {
    position_id: 'p1', ticker: 'AAPL', direction: 'long', entry_price: 170,
    current_price: 180, shares: 50, market_value: 9000, unrealized_pl: 500,
    rr_to_target: 2.5, distance_to_stop: 5, trail_method: 'SMA20', target_price: 200,
  },
  {
    position_id: 'p2', ticker: 'MSFT', direction: 'short', entry_price: 420,
    current_price: 410, shares: 20, market_value: 8200, unrealized_pl: 200,
    rr_to_target: 1.8, distance_to_stop: 3, trail_method: 'ATR', target_price: 390,
  },
];

const baseCandidates: CandidateRow[] = [
  { rank: 1, symbol: 'GOOGL', exchange_mic: 'XNAS', setup: 'Breakout', entry: 150, stop: 140, rr: 2.0, risk_usd: 500, shares: 33, sector: 'Tech', price: 152, close: 151 },
];

const baseAlerts: AlertItem[] = [
  { id: 'a1', type: 'exhaustion', symbol: 'AAPL', message: 'Exhaustion detected', timestamp: '2025-01-15T20:00:00Z' },
];

const baseKpis: KPI[] = [
  { label: 'New Candidates', value: 2 },
];

describe('KPICards', () => {
  it('renders all 4 cards', () => {
    render(
      <KPICards
        kpis={baseKpis}
        positions={basePositions}
        candidates={baseCandidates}
        alerts={baseAlerts}
        accountSize={50000}
        isLoading={false}
      />,
    );

    expect(screen.getByText('Open Positions')).toBeInTheDocument();
    expect(screen.getByText('Screener Candidates')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('shows position count and value', () => {
    render(
      <KPICards
        kpis={baseKpis}
        positions={basePositions}
        candidates={baseCandidates}
        alerts={baseAlerts}
        accountSize={50000}
        isLoading={false}
      />,
    );

    expect(screen.getByText('2 positions')).toBeInTheDocument();
    const valueEls = screen.getAllByText(/17,200/);
    expect(valueEls.length).toBe(2);
  });

  it('shows candidate count', () => {
    render(
      <KPICards
        kpis={baseKpis}
        positions={basePositions}
        candidates={baseCandidates}
        alerts={baseAlerts}
        accountSize={50000}
        isLoading={false}
      />,
    );

    expect(screen.getByText('1 candidates')).toBeInTheDocument();
  });

  it('shows alert count', () => {
    render(
      <KPICards
        kpis={baseKpis}
        positions={basePositions}
        candidates={baseCandidates}
        alerts={baseAlerts}
        accountSize={50000}
        isLoading={false}
      />,
    );

    expect(screen.getByText('1 alerts')).toBeInTheDocument();
  });

  it('shows account size and usage', () => {
    render(
      <KPICards
        kpis={baseKpis}
        positions={basePositions}
        candidates={baseCandidates}
        alerts={baseAlerts}
        accountSize={50000}
        isLoading={false}
      />,
    );

    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });

  it('renders skeleton cards when loading', () => {
    const { container } = render(
      <KPICards
        kpis={[]}
        positions={[]}
        candidates={[]}
        alerts={[]}
        accountSize={50000}
        isLoading={true}
      />,
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });
});
