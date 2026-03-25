import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { registerTradingStoreSync } from '@/features/persistence';

const Workspace = lazy(() => import('./pages/Workspace'));
const DailyReview = lazy(() => import('./pages/DailyReview'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Strategy = lazy(() => import('./pages/Strategy'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Fundamentals = lazy(() => import('./pages/Fundamentals'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Journal = lazy(() => import('./pages/Journal'));

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
                <Route index element={<Navigate to="/workspace" replace />} />
                <Route path="workspace" element={<ErrorBoundary><Workspace /></ErrorBoundary>} />
                <Route path="dashboard" element={<Navigate to="/workspace" replace />} />
                <Route path="daily-review" element={<ErrorBoundary><DailyReview /></ErrorBoundary>} />
                <Route path="portfolio" element={<ErrorBoundary><Portfolio /></ErrorBoundary>} />
                <Route path="intelligence" element={<ErrorBoundary><Intelligence /></ErrorBoundary>} />
                <Route path="fundamentals" element={<ErrorBoundary><Fundamentals /></ErrorBoundary>} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="screener" element={<Navigate to="/workspace" replace />} />
                <Route path="orders" element={<Navigate to="/portfolio" replace />} />
                <Route path="positions" element={<Navigate to="/portfolio" replace />} />
                <Route path="strategy" element={<ErrorBoundary><Strategy /></ErrorBoundary>} />
                <Route path="journal" element={<ErrorBoundary><Journal /></ErrorBoundary>} />
                <Route path="settings" element={<Navigate to="/strategy" replace />} />
                <Route path="*" element={<Navigate to="/workspace" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
