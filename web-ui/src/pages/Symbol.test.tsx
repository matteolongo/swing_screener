import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Symbol from './Symbol';
import * as fundamentalsHooks from '@/features/fundamentals/hooks';
import * as catalystHooks from '@/features/intelligence/catalysts/hooks';
import * as intelligenceHooks from '@/features/intelligence/hooks';
import * as screenerHooks from '@/features/screener/hooks';
import * as watchlistHooks from '@/features/watchlist/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { I18nProvider } from '@/i18n/I18nProvider';
import { t } from '@/i18n/t';

vi.mock('@/features/fundamentals/hooks', () => ({
  useFundamentalSnapshotQuery: vi.fn(),
  useRefreshFundamentalSnapshotMutation: vi.fn(),
}));

vi.mock('@/features/intelligence/hooks', () => ({
  useIntelligenceAnalysisMutation: vi.fn(),
  useIntelligenceLatestQuery: vi.fn(),
  useIntelligenceHistoryQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/features/intelligence/catalysts/hooks', () => ({
  useSymbolCatalystQuery: vi.fn(),
}));

vi.mock('@/features/screener/hooks', () => ({
  useRunScreenerMutation: vi.fn(),
}));

vi.mock('@/features/watchlist/hooks', () => ({
  useWatchlist: vi.fn(),
  useWatchSymbolMutation: vi.fn(),
  useUnwatchSymbolMutation: vi.fn(),
}));

vi.mock('@/components/domain/market/CachedSymbolCandleChart', () => ({
  default: ({ ticker }: { ticker: string }) => <div>Chart {ticker}</div>,
}));

function renderSymbolPage(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/symbol/:ticker" element={<Symbol />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>
  );
}

describe('Symbol page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(watchlistHooks.useWatchlist).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(watchlistHooks.useWatchSymbolMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as never);
    vi.mocked(watchlistHooks.useUnwatchSymbolMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as never);
    vi.mocked(screenerHooks.useRunScreenerMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(intelligenceHooks.useIntelligenceAnalysisMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
    vi.mocked(intelligenceHooks.useIntelligenceLatestQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(catalystHooks.useSymbolCatalystQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    useScreenerStore.setState({ lastResult: null });
  });

  it('renders the upper-cased ticker heading and the analysis tabs', async () => {
    renderSymbolPage('/symbol/aapl');

    expect(
      await screen.findByRole('heading', { name: 'AAPL', level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.overview') })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.fundamentals') })
    ).toBeInTheDocument();
  });
});
