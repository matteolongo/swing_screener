import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { I18nProvider } from '@/i18n/I18nProvider';
import { API_BASE_URL } from '@/lib/api';
import { t } from '@/i18n/t';
import { server } from '@/test/mocks/server';
import Book from './Book';

function renderBookWithRouteState(state: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[{ pathname: '/book', state }]}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/book" element={<Book />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('Book page route state', () => {
  it('opens the review tab when navigation state requests review', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/weekly-reviews/:weekId`, () =>
        HttpResponse.json({ review: null }),
      ),
      http.get(`${API_BASE_URL}/api/weekly-reviews`, () =>
        HttpResponse.json([]),
      ),
    );

    renderBookWithRouteState({ tab: 'review' });

    const reviewTab = await screen.findByRole('button', {
      name: t('bookPage.tabs.review'),
    });

    expect(reviewTab).toHaveClass('bg-primary/10');
  });
});
