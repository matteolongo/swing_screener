import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { registerTradingStoreSync } from '@/features/persistence';
import { migrateRemovedUniverseIds } from '@/features/screener/universeStorage';

migrateRemovedUniverseIds(localStorage);

const Strategy = lazy(() => import('./pages/Strategy'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

// New primary destination pages
const Today = lazy(() => import('./pages/Today'));
const Book = lazy(() => import('./pages/Book'));
const Research = lazy(() => import('./pages/Research'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function TradingStoreSyncBridge() {
  const activeQueryClient = useQueryClient();
  useEffect(() => registerTradingStoreSync(activeQueryClient), [activeQueryClient]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TradingStoreSyncBridge />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading page...</div>}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                {/* New primary destinations */}
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<ErrorBoundary><Today /></ErrorBoundary>} />
                <Route path="book" element={<ErrorBoundary><Book /></ErrorBoundary>} />
                <Route path="research" element={<ErrorBoundary><Research /></ErrorBoundary>} />

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
                <Route path="intelligence" element={<Navigate to="/research" replace />} />
                <Route path="fundamentals" element={<Navigate to="/research" replace />} />

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
