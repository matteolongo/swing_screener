import { it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScreenerTab from './ScreenerTab';
import { useScreenerStore } from '../../store/useScreenerStore';
import { useAppStore } from '../../store/useAppStore';
import type { CandidateRow } from '../../types/api';

vi.mock('../../hooks/useScreener', () => ({
  useScreener: vi.fn(),
}));

import { useScreener } from '../../hooks/useScreener';

const mockCandidates: CandidateRow[] = [
  {
    rank: 1, symbol: 'AAPL', exchange_mic: 'XNAS', setup: 'Breakout',
    entry: 180, stop: 170, rr: 2.5, risk_usd: 500, shares: 50,
    sector: 'Tech', price: 182, close: 181, catalyst: 'Earnings', gain: 3.5,
  },
  {
    rank: 2, symbol: 'MSFT', exchange_mic: 'XNAS', setup: 'Pullback',
    entry: 400, stop: 385, rr: 2.0, risk_usd: 750, shares: 20,
    sector: 'Tech', price: 405, close: 402,
  },
];

beforeEach(() => {
  useScreenerStore.setState({
    candidates: [],
    universe: 'us_sp500',
    preset: null,
    sortBy: 'score',
    isLoading: false,
    error: null,
  });
  useAppStore.setState({ activeTab: 'screener', mode: 'eod', alerts: [], accountSize: 50000 });
});

it('renders table headers and candidate rows', () => {
  vi.mocked(useScreener).mockReturnValue({
    candidates: mockCandidates,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    universe: 'us_sp500',
    setUniverse: vi.fn(),
    preset: null,
    setPreset: vi.fn(),
    sortBy: 'score',
    setSortBy: vi.fn(),
    presets: [],
  });

  render(<ScreenerTab />);

  expect(screen.getByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('MSFT')).toBeInTheDocument();
  expect(screen.getByText('Symbol')).toBeInTheDocument();
  expect(screen.getAllByText('R:R')).toHaveLength(2);
  expect(screen.getByText('Run')).toBeInTheDocument();
  expect(screen.getByText('final_close')).toBeInTheDocument();
});

it('renders simplified columns in intraday mode', () => {
  useAppStore.setState({ mode: 'intraday' });
  vi.mocked(useScreener).mockReturnValue({
    candidates: mockCandidates,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    universe: 'us_sp500',
    setUniverse: vi.fn(),
    preset: null,
    setPreset: vi.fn(),
    sortBy: 'score',
    setSortBy: vi.fn(),
    presets: [],
  });

  render(<ScreenerTab />);

  expect(screen.getByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('Symbol')).toBeInTheDocument();
  expect(screen.getAllByText('R:R').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('Run Intraday Screen')).toBeInTheDocument();
  expect(screen.getByText('intraday')).toBeInTheDocument();

  expect(screen.queryByText('Risk $')).not.toBeInTheDocument();
  expect(screen.queryByText('Shares')).not.toBeInTheDocument();
  expect(screen.queryByText('Catalyst')).not.toBeInTheDocument();
  expect(screen.queryByText('Gain')).not.toBeInTheDocument();
  expect(screen.queryByText('Entry')).not.toBeInTheDocument();
  expect(screen.queryByText('Stop')).not.toBeInTheDocument();

  useAppStore.setState({ mode: 'eod' });
});

it('shows loading spinner when isLoading', () => {
  vi.mocked(useScreener).mockReturnValue({
    candidates: [],
    isLoading: true,
    error: null,
    refetch: vi.fn(),
    universe: 'us_sp500',
    setUniverse: vi.fn(),
    preset: null,
    setPreset: vi.fn(),
    sortBy: 'score',
    setSortBy: vi.fn(),
    presets: [],
  });

  const { container } = render(<ScreenerTab />);
  expect(container.querySelector('.animate-spin')).toBeInTheDocument();
});

it('shows error message', () => {
  vi.mocked(useScreener).mockReturnValue({
    candidates: [],
    isLoading: false,
    error: 'API error',
    refetch: vi.fn(),
    universe: 'us_sp500',
    setUniverse: vi.fn(),
    preset: null,
    setPreset: vi.fn(),
    sortBy: 'score',
    setSortBy: vi.fn(),
    presets: [],
  });

  render(<ScreenerTab />);
  expect(screen.getByText('API error')).toBeInTheDocument();
});

it('shows empty state when no candidates', () => {
  vi.mocked(useScreener).mockReturnValue({
    candidates: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    universe: 'us_sp500',
    setUniverse: vi.fn(),
    preset: null,
    setPreset: vi.fn(),
    sortBy: 'score',
    setSortBy: vi.fn(),
    presets: [],
  });

  render(<ScreenerTab />);
  expect(screen.getByText(/No candidates found/)).toBeInTheDocument();
});
