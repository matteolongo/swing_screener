import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import WatchlistPipelinePanel from '@/components/domain/watchlist/WatchlistPipelinePanel';

vi.mock('@/features/watchlist/hooks', () => ({
  useWatchlist: () => ({
    data: [
      {
        ticker: 'ASML',
        watchedAt: '2026-05-01T10:00:00Z',
        watchPrice: 660,
        currentPrice: 671,
        currency: 'EUR',
        source: 'screener',
        signal: 'breakout',
        signalTriggerPrice: 680,
        distanceToTriggerPct: -1.3,
        priceHistory: [
          { date: '2026-04-28', close: 650 },
          { date: '2026-04-29', close: 655 },
          { date: '2026-04-30', close: 662 },
          { date: '2026-05-01', close: 668 },
          { date: '2026-05-02', close: 671 },
        ],
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

describe('WatchlistPipelinePanel', () => {
  it('renders distance-to-trigger copy and sparkline row', () => {
    renderWithProviders(<WatchlistPipelinePanel />);

    expect(screen.getByText('Watchlist Pipeline')).toBeInTheDocument();
    expect(screen.getByText('ASML')).toBeInTheDocument();
    expect(screen.getByText('-1.3% to buy zone')).toBeInTheDocument();
    expect(screen.getByText('Trigger €680.00')).toBeInTheDocument();
    expect(screen.getByText('BREAKOUT')).toBeInTheDocument();
  });
});
