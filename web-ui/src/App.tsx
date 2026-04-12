import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { registerTradingStoreSync } from '@/features/persistence';
import { migrateRemovedUniverseIds } from '@/features/screener/universeStorage';

migrateRemovedUniverseIds(localStorage);
localStorage.removeItem('swing-screener-beginner-mode');

const Onboarding = lazy(() => import('./pages/Onboarding'));
const Learn = lazy(() => import('./pages/Learn'));
const Practice = lazy(() => import('./pages/Practice'));
const Review = lazy(() => import('./pages/Review'));
const Journal = lazy(() => import('./pages/Journal'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Fundamentals = lazy(() => import('./pages/Fundamentals'));
const Calendar = lazy(() => import('./pages/Calendar'));

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
                <Route index element={<Navigate to="/practice" replace />} />
                <Route path="practice" element={<ErrorBoundary><Practice /></ErrorBoundary>} />
                <Route path="learn" element={<ErrorBoundary><Learn /></ErrorBoundary>} />
                <Route path="learn/settings" element={<ErrorBoundary><Learn /></ErrorBoundary>} />
                <Route path="review" element={<ErrorBoundary><Review /></ErrorBoundary>} />
                <Route path="journal" element={<ErrorBoundary><Journal /></ErrorBoundary>} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="intelligence" element={<ErrorBoundary><Intelligence /></ErrorBoundary>} />
                <Route path="fundamentals" element={<ErrorBoundary><Fundamentals /></ErrorBoundary>} />
                <Route path="calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />

                <Route path="today" element={<Navigate to="/practice" replace />} />
                <Route path="book" element={<Navigate to="/review" replace />} />
                <Route path="research" element={<Navigate to="/learn" replace />} />
                <Route path="strategy" element={<Navigate to="/learn/settings" replace />} />
                <Route path="settings" element={<Navigate to="/learn/settings" replace />} />

                <Route path="workspace" element={<Navigate to="/practice" replace />} />
                <Route path="daily-review" element={<Navigate to="/practice" replace />} />
                <Route path="portfolio" element={<Navigate to="/review" replace />} />
                <Route path="analytics" element={<Navigate to="/journal" replace />} />
                <Route path="dashboard" element={<Navigate to="/practice" replace />} />
                <Route path="screener" element={<Navigate to="/practice" replace />} />
                <Route path="orders" element={<Navigate to="/review" replace />} />
                <Route path="positions" element={<Navigate to="/review" replace />} />

                <Route path="*" element={<Navigate to="/practice" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
