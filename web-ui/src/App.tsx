import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import { registerTradingStoreSync } from '@/features/persistence';

const DailyReview = lazy(() => import('./pages/DailyReview'));
const Strategy = lazy(() => import('./pages/Strategy'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Archive = lazy(() => import('./pages/Archive'));
const NotFound = lazy(() => import('./pages/NotFound'));

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
        <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/daily-review" replace />} />
              <Route path="dashboard" element={<Navigate to="/daily-review" replace />} />
              <Route path="daily-review" element={<DailyReview />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="archive" element={<Archive />} />
              <Route path="screener" element={<Navigate to="/daily-review" replace />} />
              <Route path="orders" element={<Navigate to="/daily-review" replace />} />
              <Route path="positions" element={<Navigate to="/archive" replace />} />
              <Route path="strategy" element={<Strategy />} />
              <Route path="settings" element={<Navigate to="/strategy" replace />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
