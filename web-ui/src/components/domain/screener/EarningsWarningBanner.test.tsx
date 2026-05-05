import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import EarningsWarningBanner from './EarningsWarningBanner';
import { server } from '@/test/mocks/server';
import { renderWithProviders, screen } from '@/test/utils';

describe('EarningsWarningBanner', () => {
  it('shows warning when earnings are within 10 days', async () => {
    server.use(
      http.get('*/api/portfolio/earnings-proximity/AAPL', () =>
        HttpResponse.json({
          ticker: 'AAPL',
          next_earnings_date: '2026-05-08',
          days_until: 5,
          warning: true,
        }),
      ),
    );

    renderWithProviders(<EarningsWarningBanner ticker="AAPL" />);

    expect(await screen.findByText(/5 days/i)).toBeInTheDocument();
  });

  it('renders nothing when no warning is returned', async () => {
    server.use(
      http.get('*/api/portfolio/earnings-proximity/AAPL', () =>
        HttpResponse.json({
          ticker: 'AAPL',
          next_earnings_date: null,
          days_until: null,
          warning: false,
        }),
      ),
    );

    const { container } = renderWithProviders(<EarningsWarningBanner ticker="AAPL" />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing when ticker is undefined', () => {
    const { container } = renderWithProviders(<EarningsWarningBanner ticker={undefined} />);

    expect(container.firstChild).toBeNull();
  });
});
