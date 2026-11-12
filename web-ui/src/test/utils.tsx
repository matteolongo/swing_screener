import { ReactElement } from 'react'
import { fireEvent, render, RenderOptions, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n/I18nProvider'

// Create a new QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry failed queries in tests
        gcTime: 0, // Don't cache results
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Custom render with all providers
export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    route = '/',
    router = 'browser',
    ...renderOptions
  }: RenderOptions & { queryClient?: QueryClient; route?: string; router?: 'browser' | 'memory' } = {}
) {
  // Set initial route
  window.history.pushState({}, 'Test page', route)

  function Wrapper({ children }: { children: React.ReactNode }) {
    const content = (
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </I18nProvider>
    )
    const future = { v7_startTransition: true, v7_relativeSplatPath: true }
    // Happy DOM history methods are no-ops; navigation tests need MemoryRouter.
    return router === 'memory'
      ? <MemoryRouter initialEntries={[route]} future={future}>{content}</MemoryRouter>
      : <BrowserRouter future={future}>{content}</BrowserRouter>
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
    user: userEvent.setup(),
  }
}

export async function waitForQueriesToSettle(queryClient: QueryClient) {
  await waitFor(() => {
    if (queryClient.isFetching() !== 0) {
      throw new Error('Queries still fetching')
    }
  })
}

export function openNativeDisclosure(label: HTMLElement) {
  const details = label.closest('summary')?.parentElement
  if (details?.tagName !== 'DETAILS') {
    throw new Error('Expected a native disclosure summary')
  }

  // Happy DOM does not implement the browser's default summary activation.
  details.setAttribute('open', '')
  fireEvent(details, new Event('toggle'))
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { userEvent }
