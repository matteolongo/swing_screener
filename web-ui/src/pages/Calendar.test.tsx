import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Calendar from './Calendar';
import { t } from '@/i18n/t';

describe('Calendar page', () => {
  it('renders page title', async () => {
    renderWithProviders(<Calendar />);
    expect(await screen.findByText(t('calendarPage.title'))).toBeInTheDocument();
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
    expect(await screen.findByText(t('calendarPage.legend.position'))).toBeInTheDocument();
    expect(await screen.findByText(t('calendarPage.legend.screener'))).toBeInTheDocument();
    // 'Economic event' appears in both the legend and the event badge — use getAllByText
    const economicMatches = await screen.findAllByText(t('calendarPage.legend.economic'));
    expect(economicMatches.length).toBeGreaterThanOrEqual(1);
  });
});
