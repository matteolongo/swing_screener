import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('lightweight-charts');
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '@/lib/api';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
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
    useWorkspaceStore.setState({ selection: null });
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

  it('uses the selected candidate bars instead of an unrelated Last Run snapshot', () => {
    seedStore(300);
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: 'AAA', source: 'today_run', rowId: 'today:AAA',
      candidate: {
        ticker: 'AAA', rank: 1, entry: 100,
        priceHistory: [{ date: '2025-01-01', open: 100, high: 101, low: 99, close: 100, volume: 1000 }],
        patterns: [],
      } as any,
    });
    renderWithProviders(<CachedSymbolCandleChart ticker="AAA" />);
    expect(screen.queryByRole('button', { name: '1W' })).not.toBeInTheDocument();
  });

  it('fetches direct candles for a selected symbol without a candidate snapshot', async () => {
    seedStore(300);
    let requests = 0;
    server.use(http.get(`${API_BASE_URL}/api/market-data/AAA/candles`, () => {
      requests += 1;
      return HttpResponse.json({ ticker: 'AAA', price_history: [], patterns: [] });
    }));
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: 'AAA', source: 'today_position', rowId: 'position:AAA',
    });
    renderWithProviders(<CachedSymbolCandleChart ticker="AAA" />);
    await waitFor(() => expect(requests).toBe(1));
  });
});
