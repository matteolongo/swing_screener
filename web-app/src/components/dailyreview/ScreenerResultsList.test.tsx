import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScreenerResultsList from './ScreenerResultsList';
import { useAppStore } from '../../store/useAppStore';
import type { CandidateRow } from '../../types/api';

const candidates: CandidateRow[] = [
  { rank: 1, symbol: 'AAPL', exchange_mic: 'XNAS', setup: 'Breakout', entry: 180, stop: 170, rr: 2.5, risk_usd: 500, shares: 50, sector: 'Tech', price: 182, close: 181 },
  { rank: 2, symbol: 'GOOGL', exchange_mic: 'XNAS', setup: 'Pullback', entry: 150, stop: 140, rr: 1.8, risk_usd: 400, shares: 30, sector: 'Tech', price: 152, close: 151 },
  { rank: 3, symbol: 'MSFT', exchange_mic: 'XNAS', setup: 'Momentum', entry: 400, stop: 385, rr: 1.2, risk_usd: 750, shares: 20, sector: 'Tech', price: 405, close: 402 },
];

beforeEach(() => {
  useAppStore.setState({ activeTab: 'screener', mode: 'eod', alerts: [], accountSize: 50000 });
});

describe('ScreenerResultsList', () => {
  it('renders table headers', () => {
    render(<ScreenerResultsList candidates={candidates} isLoading={false} />);

    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Setup')).toBeInTheDocument();
    expect(screen.getByText('R:R')).toBeInTheDocument();
    expect(screen.getByText('Sector')).toBeInTheDocument();
  });

  it('renders candidate symbols', () => {
    render(<ScreenerResultsList candidates={candidates} isLoading={false} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('renders setup badge with color', () => {
    render(<ScreenerResultsList candidates={candidates} isLoading={false} />);

    const breakout = screen.getByText('Breakout');
    expect(breakout.className).toContain('text-success');
  });

  it('renders colored R:R values', () => {
    render(<ScreenerResultsList candidates={candidates} isLoading={false} />);

    const rr25 = screen.getByText('2.50');
    expect(rr25.className).toContain('text-success');
  });

  it('shows "View all" link when more than 10 candidates', () => {
    const manyCandidates = Array.from({ length: 15 }, (_, i) => ({
      ...candidates[0],
      rank: i + 1,
      symbol: `SYM${i}`,
    }));

    render(<ScreenerResultsList candidates={manyCandidates} isLoading={false} />);

    const viewAll = screen.getByText(/View all/);
    expect(viewAll).toBeInTheDocument();
  });

  it('does not show "View all" when 10 or fewer', () => {
    render(<ScreenerResultsList candidates={candidates} isLoading={false} />);

    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it('shows empty state when no candidates', () => {
    render(<ScreenerResultsList candidates={[]} isLoading={false} />);

    expect(screen.getByText(/No screener results yet/)).toBeInTheDocument();
  });

  it('renders skeleton rows when loading', () => {
    const { container } = render(<ScreenerResultsList candidates={[]} isLoading={true} />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
