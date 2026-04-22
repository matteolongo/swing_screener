import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import SymbolTradeHistory from './SymbolTradeHistory';

// Recurrence is not under test here — stub it out to avoid XHR noise
vi.mock('@/features/screener/recurrenceHooks', () => ({
  useScreenerRecurrence: () => ({ data: [], isLoading: false }),
}));

const closedPosition = {
  ticker: 'AAPL',
  status: 'closed' as const,
  entry_date: '2026-01-10',
  entry_price: 100,
  stop_price: 95,
  shares: 5,
  exit_date: '2026-02-01',
  exit_price: 110,
  notes: '',
  position_id: 'pos-1',
  source_order_id: null,
  initial_risk: 25,
  max_favorable_price: null,
  current_price: null,
  exit_order_ids: null,
};

describe('SymbolTradeHistory', () => {
  it('shows past trades table with R outcome', async () => {
    server.use(
      http.get('*/api/portfolio/symbol-history/AAPL', () =>
        HttpResponse.json({
          ticker: 'AAPL',
          positions: [closedPosition],
          open_count: 0,
          closed_count: 1,
        })
      )
    );

    renderWithProviders(<SymbolTradeHistory ticker="AAPL" />);

    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(await screen.findByText('1 trade')).toBeInTheDocument();
  });

  it('shows empty state when no history', async () => {
    server.use(
      http.get('*/api/portfolio/symbol-history/MSFT', () =>
        HttpResponse.json({ ticker: 'MSFT', positions: [], open_count: 0, closed_count: 0 })
      )
    );

    renderWithProviders(<SymbolTradeHistory ticker="MSFT" />);

    expect(await screen.findByText(/no past trades/i)).toBeInTheDocument();
  });
});
