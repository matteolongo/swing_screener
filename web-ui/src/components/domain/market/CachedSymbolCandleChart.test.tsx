import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { useScreenerStore } from '@/stores/screenerStore';
import { CachedSymbolCandleChart } from './CachedSymbolCandleChart';
import type { ScreenerResponse } from '@/features/screener/types';

function seedStore(barCount: number) {
  const start = new Date('2025-01-01T00:00:00Z');
  const priceHistory = Array.from({ length: barCount }, (_, i) => {
    const d = new Date(start.getTime());
    d.setUTCDate(start.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), open: 10, high: 11, low: 9, close: 10 + i * 0.01, volume: 1000 };
  });
  useScreenerStore.setState({
    lastResult: {
      candidates: [{ ticker: 'AAA', rank: 1, priceHistory, patterns: [] }],
      benchmarkTicker: '^AEX',
    } as unknown as ScreenerResponse,
  });
}

describe('CachedSymbolCandleChart', () => {
  beforeEach(() => {
    useScreenerStore.setState({ lastResult: null });
  });

  it('renders range buttons including 1W and MAX', () => {
    seedStore(300);
    renderWithProviders(<CachedSymbolCandleChart ticker="AAA" />);
    expect(screen.getByRole('button', { name: '1W' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MAX' })).toBeInTheDocument();
  });

  it('opens and closes the fullscreen overlay', () => {
    seedStore(300);
    renderWithProviders(<CachedSymbolCandleChart ticker="AAA" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // both the inline and overlay toolbars now show "Exit fullscreen"
    fireEvent.click(screen.getAllByRole('button', { name: 'Exit fullscreen' })[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
