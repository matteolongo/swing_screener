import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Calendar from './Calendar';

describe('Calendar page', () => {
  it('renders page title', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('Events Calendar')).toBeInTheDocument();
  });

  it('renders an earnings event for a position', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('AAPL Earnings')).toBeInTheDocument();
  });

  it('renders a screener earnings event', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('MSFT Earnings')).toBeInTheDocument();
  });

  it('renders an economic event', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('US CPI Release')).toBeInTheDocument();
  });

  it('shows source legend', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText('Position')).toBeInTheDocument();
    expect(await screen.findByText('Screener hit')).toBeInTheDocument();
    // 'Economic event' appears in both the legend and the event badge — use getAllByText
    const economicMatches = await screen.findAllByText('Economic event');
    expect(economicMatches.length).toBeGreaterThanOrEqual(1);
  });
});
