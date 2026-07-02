import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { messagesEn } from '@/i18n/messages.en';
import { t } from '@/i18n/t';
import Screener from './Screener';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}{location.search}</div>;
}

function renderScreenerPage(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/screener" element={<><Screener /><LocationDisplay /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>
  );
}

describe('Screener page', () => {
  it('renders both tabs and defaults to Candidates', async () => {
    renderScreenerPage('/screener');

    expect(screen.getByText(messagesEn.screenerPage.title)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: messagesEn.screenerPage.tabs.candidates })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: messagesEn.screenerPage.tabs.watchlist })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: messagesEn.screenerPage.tabs.candidates })
    ).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('button', { name: t('screener.controls.run') })).toBeInTheDocument();
  });

  it('switches to the Watchlist tab and updates the URL', async () => {
    const user = userEvent.setup();
    renderScreenerPage('/screener');

    const watchlistTab = screen.getByRole('tab', { name: messagesEn.screenerPage.tabs.watchlist });
    await user.click(watchlistTab);

    expect(watchlistTab).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(messagesEn.watchlist.pipeline.empty)).toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent('/screener?tab=watchlist');
  });

  it('opens on the Watchlist tab when ?tab=watchlist is present in the URL', async () => {
    renderScreenerPage('/screener?tab=watchlist');

    expect(
      screen.getByRole('tab', { name: messagesEn.screenerPage.tabs.watchlist })
    ).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(messagesEn.watchlist.pipeline.empty)).toBeInTheDocument();
  });
});
