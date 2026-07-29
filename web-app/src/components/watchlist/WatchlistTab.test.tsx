import { it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WatchlistTab from './WatchlistTab';
import { useWatchlistStore } from '../../store/useWatchlistStore';
import { useAppStore } from '../../store/useAppStore';
import type { WatchlistItem } from '../../types/api';

vi.mock('../../hooks/useWatchlist', () => ({
  useWatchlist: vi.fn(),
}));

import { useWatchlist } from '../../hooks/useWatchlist';

const mockItems: WatchlistItem[] = [
  { symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, setup: 'Breakout', rr: 2.5, sector: 'Tech', held: 10 },
  { symbol: 'MSFT', exchange_mic: 'XNAS', price: 405, change_pct: -0.5, sector: 'Tech', held: undefined },
];

beforeEach(() => {
  useWatchlistStore.setState({ items: [], isLoading: false, error: null });
  useAppStore.setState({ activeTab: 'watchlist', mode: 'eod', alerts: [], accountSize: 50000 });
  vi.mocked(useWatchlist).mockReturnValue({
    items: [],
    isLoading: false,
    error: null,
    fetchWatchlist: vi.fn(),
    addWatchlistItem: vi.fn(),
    removeWatchlistItem: vi.fn(),
    runScreenerForSymbol: vi.fn(),
    runScreenerOnWatchlist: vi.fn(),
  });
});

it('renders table headers and rows', () => {
  vi.mocked(useWatchlist).mockReturnValue({
    items: mockItems,
    isLoading: false,
    error: null,
    fetchWatchlist: vi.fn(),
    addWatchlistItem: vi.fn(),
    removeWatchlistItem: vi.fn(),
    runScreenerForSymbol: vi.fn(),
    runScreenerOnWatchlist: vi.fn(),
  });

  render(<WatchlistTab />);

  expect(screen.getByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('MSFT')).toBeInTheDocument();
  expect(screen.getAllByText('Symbol')).toHaveLength(2);
  expect(screen.getAllByText('Price')).toHaveLength(2);
  expect(screen.getAllByText('Change %')).toHaveLength(2);
  expect(screen.getByText('Add')).toBeInTheDocument();
  expect(screen.getByText('Run Screener on Watchlist')).toBeInTheDocument();
});

it('shows empty state', () => {
  render(<WatchlistTab />);
  expect(screen.getByText(/Your watchlist is empty/)).toBeInTheDocument();
});

it('shows loading state', () => {
  vi.mocked(useWatchlist).mockReturnValue({
    items: [],
    isLoading: true,
    error: null,
    fetchWatchlist: vi.fn(),
    addWatchlistItem: vi.fn(),
    removeWatchlistItem: vi.fn(),
    runScreenerForSymbol: vi.fn(),
    runScreenerOnWatchlist: vi.fn(),
  });

  render(<WatchlistTab />);
  expect(screen.getByText(/Loading watchlist/)).toBeInTheDocument();
});

it('shows error message', () => {
  vi.mocked(useWatchlist).mockReturnValue({
    items: [],
    isLoading: false,
    error: 'API error',
    fetchWatchlist: vi.fn(),
    addWatchlistItem: vi.fn(),
    removeWatchlistItem: vi.fn(),
    runScreenerForSymbol: vi.fn(),
    runScreenerOnWatchlist: vi.fn(),
  });

  render(<WatchlistTab />);
  expect(screen.getByText('API error')).toBeInTheDocument();
});

it('opens AddSymbolDialog on Add click', () => {
  render(<WatchlistTab />);
  fireEvent.click(screen.getByText('Add'));
  expect(screen.getByPlaceholderText('Search symbol...')).toBeInTheDocument();
});

it('disables Run Screener button when watchlist is empty', () => {
  render(<WatchlistTab />);
  const btn = screen.getByText('Run Screener on Watchlist').closest('button')!;
  expect(btn.disabled).toBe(true);
});

it('enables Run Screener button when watchlist has items', () => {
  vi.mocked(useWatchlist).mockReturnValue({
    items: mockItems,
    isLoading: false,
    error: null,
    fetchWatchlist: vi.fn(),
    addWatchlistItem: vi.fn(),
    removeWatchlistItem: vi.fn(),
    runScreenerForSymbol: vi.fn(),
    runScreenerOnWatchlist: vi.fn(),
  });

  render(<WatchlistTab />);
  const btn = screen.getByText('Run Screener on Watchlist').closest('button')!;
  expect(btn.disabled).toBe(false);
});
