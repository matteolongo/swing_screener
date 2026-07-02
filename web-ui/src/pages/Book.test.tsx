import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { messagesEn } from '@/i18n/messages.en';
import Book from './Book';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}{location.search}</div>;
}

function renderBookPage(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/book" element={<><Book /><LocationDisplay /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>
  );
}

describe('Book page', () => {
  it('renders all tabs and defaults to Positions when no ?tab= is present', () => {
    renderBookPage('/book');

    expect(screen.getByText(messagesEn.bookPage.title)).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: messagesEn.bookPage.tabs.positions })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: messagesEn.bookPage.tabs.orders })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: messagesEn.bookPage.tabs.journal })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: messagesEn.bookPage.tabs.performance })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: messagesEn.bookPage.tabs.review })).toBeInTheDocument();
  });

  it('switches to the Weekly Review tab and updates the URL', async () => {
    const user = userEvent.setup();
    renderBookPage('/book');

    const reviewTab = screen.getByRole('tab', { name: messagesEn.bookPage.tabs.review });
    await user.click(reviewTab);

    expect(reviewTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/book?tab=review');
  });

  it('opens on the Weekly Review tab when ?tab=review is present in the URL', () => {
    renderBookPage('/book?tab=review');

    expect(
      screen.getByRole('tab', { name: messagesEn.bookPage.tabs.review })
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to the Positions tab for an unknown ?tab= value', () => {
    renderBookPage('/book?tab=bogus');

    expect(
      screen.getByRole('tab', { name: messagesEn.bookPage.tabs.positions })
    ).toHaveAttribute('aria-selected', 'true');
  });
});
