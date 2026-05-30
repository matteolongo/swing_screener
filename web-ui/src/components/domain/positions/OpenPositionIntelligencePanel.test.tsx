import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OpenPositionIntelligencePanel from './OpenPositionIntelligencePanel';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

const openPositionsUrl = '/api/portfolio/positions/open/intelligence';

const mockPositionRow = {
  position_id: 'pos-1',
  ticker: 'BESI.AS',
  entry_price: 250,
  stop_price: 230,
  current_price: 287.6,
  r_now: 1.88,
  days_open: 14,
  stop_action: 'MOVE_STOP_UP',
  stop_suggested: 240,
  stop_reason: 'Trail: R=1.88',
  intelligence: null,
};

describe('OpenPositionIntelligencePanel', () => {
  it('renders nothing when there are no open positions', async () => {
    server.use(
      http.get(openPositionsUrl, () => HttpResponse.json([])),
    );
    const { container } = renderWithProviders(
      <OpenPositionIntelligencePanel onTickerSelect={vi.fn()} />,
    );
    // With empty data the component returns null — nothing rendered
    expect(container.firstChild).toBeNull();
  });

  it('renders a row per open position', async () => {
    server.use(
      http.get(openPositionsUrl, () => HttpResponse.json([mockPositionRow])),
    );
    renderWithProviders(<OpenPositionIntelligencePanel onTickerSelect={vi.fn()} />);
    expect(await screen.findByText('BESI.AS')).toBeInTheDocument();
    expect(screen.getByText('+1.88R')).toBeInTheDocument();
  });

  it('shows intelligence summary line when available', async () => {
    server.use(
      http.get(openPositionsUrl, () =>
        HttpResponse.json([
          {
            ...mockPositionRow,
            intelligence: {
              symbol: 'BESI.AS',
              generated_at: '2026-05-30T03:00:00',
              action: 'BUY_ON_PULLBACK',
              conviction: 'medium',
              catalyst_urgency: 'none',
              summary_line: 'Thesis intact, trail stop.',
              narrative: '...',
              upcoming_events: [],
              position_signal: { action: 'HOLD', reason: 'Strong momentum.' },
              position_outlook: null,
              sources: [],
              inputs_used: {},
            },
          },
        ]),
      ),
    );
    renderWithProviders(<OpenPositionIntelligencePanel onTickerSelect={vi.fn()} />);
    expect(await screen.findByText('Thesis intact, trail stop.')).toBeInTheDocument();
  });

  it('calls onTickerSelect when a position row is clicked', async () => {
    const onSelect = vi.fn();
    server.use(
      http.get(openPositionsUrl, () => HttpResponse.json([mockPositionRow])),
    );
    const { user } = renderWithProviders(
      <OpenPositionIntelligencePanel onTickerSelect={onSelect} />,
    );
    const ticker = await screen.findByText('BESI.AS');
    await user.click(ticker);
    expect(onSelect).toHaveBeenCalledWith('BESI.AS');
  });
});
