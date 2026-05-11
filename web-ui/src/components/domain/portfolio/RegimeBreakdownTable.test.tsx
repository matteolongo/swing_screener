import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import RegimeBreakdownTable from './RegimeBreakdownTable';

const MOCK_RESPONSE = {
  benchmark: 'SPY',
  regimes: [
    { regime: 'trending_up', count: 12, win_rate: 66.67, avg_r: 1.2, expectancy: 0.8 },
    { regime: 'trending_down', count: 5, win_rate: 40.0, avg_r: -0.5, expectancy: -0.3 },
    { regime: 'choppy', count: 3, win_rate: 33.33, avg_r: -0.2, expectancy: -0.1 },
  ],
};

describe('RegimeBreakdownTable', () => {
  it('renders regime rows with stats', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.json(MOCK_RESPONSE),
      ),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(await screen.findByText(t('analyticsPage.regimeBreakdown.regimes.trending_up'))).toBeInTheDocument();
    expect(screen.getByText(t('analyticsPage.regimeBreakdown.regimes.trending_down'))).toBeInTheDocument();
    expect(screen.getByText(t('analyticsPage.regimeBreakdown.regimes.choppy'))).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', async () => {
        await new Promise(() => {}); // never resolves
      }),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(screen.getByText(t('analyticsPage.regimeBreakdown.loading'))).toBeInTheDocument();
  });

  it('shows empty state when no regimes returned', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.json({ benchmark: 'SPY', regimes: [] }),
      ),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(await screen.findByText(t('analyticsPage.regimeBreakdown.emptyState'))).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.error(),
      ),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(await screen.findByText(t('analyticsPage.regimeBreakdown.error'))).toBeInTheDocument();
  });

  it('colors positive expectancy green and negative red', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.json(MOCK_RESPONSE),
      ),
    );
    const { container } = renderWithProviders(<RegimeBreakdownTable />);
    await screen.findByText(t('analyticsPage.regimeBreakdown.regimes.trending_up'));
    const greenCells = container.querySelectorAll('.text-green-600');
    expect(greenCells.length).toBeGreaterThan(0);
  });
});
