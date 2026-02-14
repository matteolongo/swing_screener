import { ReactElement } from 'react'
import { render, RenderOptions, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
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
    ...renderOptions
  }: RenderOptions & { queryClient?: QueryClient; route?: string } = {}
) {
  // Set initial route
  window.history.pushState({}, 'Test page', route)

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {children}
          </BrowserRouter>
        </QueryClientProvider>
      </I18nProvider>
    )
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

// Re-export everything from testing-library
export * from '@testing-library/react'
export { userEvent }
