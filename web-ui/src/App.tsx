import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { migrateRemovedUniverseIds } from '@/features/screener/universeStorage';

migrateRemovedUniverseIds(localStorage);

const Strategy = lazy(() => import('./pages/Strategy'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

// New primary destination pages
const Today = lazy(() => import('./pages/Today'));
const Book = lazy(() => import('./pages/Book'));
const Universes = lazy(() => import('./pages/Universes'));
const Calendar = lazy(() => import('./pages/Calendar'));
const DataSources = lazy(() => import('./pages/DataSources'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<div className="p-6 text-sm text-muted">Loading page...</div>}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                {/* New primary destinations */}
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<ErrorBoundary><Today /></ErrorBoundary>} />
                <Route path="calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
                <Route path="book" element={<ErrorBoundary><Book /></ErrorBoundary>} />
                <Route path="universes" element={<ErrorBoundary><Universes /></ErrorBoundary>} />
                <Route path="datasources" element={<ErrorBoundary><DataSources /></ErrorBoundary>} />

                {/* Strategy / settings — still accessible */}
                <Route path="strategy" element={<ErrorBoundary><Strategy /></ErrorBoundary>} />
                <Route path="settings" element={<Navigate to="/strategy" replace />} />

                {/* Onboarding */}
                <Route path="onboarding" element={<Onboarding />} />

                {/* Legacy routes → redirects to new destinations */}
                <Route path="workspace" element={<Navigate to="/today" replace />} />
                <Route path="daily-review" element={<Navigate to="/today" replace />} />
                <Route path="portfolio" element={<Navigate to="/book" replace />} />
                <Route path="journal" element={<Navigate to="/book" replace />} />
                <Route path="analytics" element={<Navigate to="/book" replace />} />
                <Route path="research" element={<Navigate to="/today" replace />} />
                <Route path="intelligence" element={<Navigate to="/today" replace />} />
                <Route path="fundamentals" element={<Navigate to="/today" replace />} />

                {/* Other legacy redirects */}
                <Route path="dashboard" element={<Navigate to="/today" replace />} />
                <Route path="screener" element={<Navigate to="/today" replace />} />
                <Route path="orders" element={<Navigate to="/book" replace />} />
                <Route path="positions" element={<Navigate to="/book" replace />} />

                <Route path="*" element={<Navigate to="/today" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
