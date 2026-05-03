import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import JournalPage from './Journal';
import { t } from '@/i18n/t';

const closedPositions = [
  {
    position_id: 'POS-001',
    ticker: 'AAPL',
    status: 'closed',
    entry_date: '2026-01-01',
    entry_price: 100,
    stop_price: 95,
    shares: 10,
    initial_risk: 50,
    exit_price: 110,
    exit_date: '2026-01-15',
    current_price: null,
    source_order_id: null,
    max_favorable_price: null,
    notes: '',
    exit_order_ids: null,
    thesis: null,
    lesson: null,
    tags: ['breakout'],
    pnl: 100,
    pnl_percent: 10,
    r_now: 2,
    entry_value: 1000,
    current_value: 1100,
    per_share_risk: 5,
    total_risk: 50,
    fees_eur: 0,
  },
  {
    position_id: 'POS-002',
    ticker: 'MSFT',
    status: 'closed',
    entry_date: '2026-01-05',
    entry_price: 200,
    stop_price: 190,
    shares: 5,
    initial_risk: 50,
    exit_price: 195,
    exit_date: '2026-01-20',
    current_price: null,
    source_order_id: null,
    max_favorable_price: null,
    notes: '',
    exit_order_ids: null,
    thesis: null,
    lesson: null,
    tags: ['pullback', 'stop_hit'],
    pnl: -25,
    pnl_percent: -2.5,
    r_now: -0.5,
    entry_value: 1000,
    current_value: 975,
    per_share_risk: 10,
    total_risk: 50,
    fees_eur: 0,
  },
] as const;

describe('Journal tag filtering', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/portfolio/positions', () =>
        HttpResponse.json({ positions: closedPositions, asof: '2026-01-20' }),
      ),
    );
  });

  it('shows both positions with no filter active', async () => {
    renderWithProviders(<JournalPage />);

    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('filters to only breakout trades when breakout chip clicked', async () => {
    renderWithProviders(<JournalPage />);

    await screen.findByText('AAPL');
    fireEvent.click(screen.getByRole('button', { name: t('tradeTags.breakout') }));

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
  });

  it('clicking active filter chip clears it', async () => {
    renderWithProviders(<JournalPage />);

    await screen.findByText('AAPL');
    const breakoutFilter = screen.getByRole('button', { name: t('tradeTags.breakout') });
    fireEvent.click(breakoutFilter);
    fireEvent.click(breakoutFilter);

    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });
});
