import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { migrateRemovedUniverseIds } from '@/features/screener/universeStorage';

migrateRemovedUniverseIds(localStorage);

const Strategy = lazy(() => import('./pages/Strategy'));

// New primary destination pages
const Today = lazy(() => import('./pages/Today'));
const Book = lazy(() => import('./pages/Book'));
const Universes = lazy(() => import('./pages/Universes'));
const Calendar = lazy(() => import('./pages/Calendar'));
const DataSources = lazy(() => import('./pages/DataSources'));
const System = lazy(() => import('./pages/System'));

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
                <Route path="system" element={<ErrorBoundary><System /></ErrorBoundary>}>
                  <Route index element={<Navigate to="/system/pool" replace />} />
                  <Route path="pool" element={<ErrorBoundary><Universes /></ErrorBoundary>} />
                  <Route path="datasources" element={<ErrorBoundary><DataSources /></ErrorBoundary>} />
                  <Route path="strategy" element={<ErrorBoundary><Strategy /></ErrorBoundary>} />
                </Route>

                {/* moved-page redirects */}
                <Route path="universes" element={<Navigate to="/system/pool" replace />} />
                <Route path="datasources" element={<Navigate to="/system/datasources" replace />} />
                <Route path="strategy" element={<Navigate to="/system/strategy" replace />} />
                <Route path="settings" element={<Navigate to="/system/strategy" replace />} />

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
