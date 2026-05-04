import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import WatchlistPipelineTable from './WatchlistPipelineTable';
import { t } from '@/i18n/t';

const PIPELINE_RESPONSE = {
  items: [
    {
      ticker: 'AAPL',
      current_price: 182.5,
      watch_price: 180.0,
      signal: 'breakout',
      trigger_price: 180.0,
      trigger_type: 'breakout',
      distance_pct: 1.39,
      sparkline: [178.0, 179.0, 180.5, 181.0, 182.5],
    },
    {
      ticker: 'SBMO.AS',
      current_price: 35.0,
      watch_price: 34.0,
      signal: 'none',
      trigger_price: 36.0,
      trigger_type: 'breakout',
      distance_pct: -2.78,
      sparkline: [33.5, 34.0, 34.5, 34.8, 35.0],
    },
  ],
};

describe('WatchlistPipelineTable', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/watchlist/pipeline', () => HttpResponse.json(PIPELINE_RESPONSE))
    );
  });

  it('renders ticker for each pipeline item', async () => {
    renderWithProviders(<WatchlistPipelineTable />);
    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(await screen.findByText('SBMO.AS')).toBeInTheDocument();
  });

  it('shows distance_pct formatted with % sign', async () => {
    renderWithProviders(<WatchlistPipelineTable />);
    expect(await screen.findByText(/-2\.78%/)).toBeInTheDocument();
  });

  it('renders empty state when no items', async () => {
    server.use(
      http.get('*/api/watchlist/pipeline', () => HttpResponse.json({ items: [] }))
    );
    renderWithProviders(<WatchlistPipelineTable />);
    expect(await screen.findByText(t('watchlistPipeline.empty'))).toBeInTheDocument();
  });
});
