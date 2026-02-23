import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';

const Workspace = lazy(() => import('./pages/Workspace'));
const DailyReview = lazy(() => import('./pages/DailyReview'));
const Backtest = lazy(() => import('./pages/Backtest'));
const Strategy = lazy(() => import('./pages/Strategy'));

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
        <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/workspace" replace />} />
              <Route path="workspace" element={<Workspace />} />
              <Route path="dashboard" element={<Navigate to="/workspace" replace />} />
              <Route path="daily-review" element={<DailyReview />} />
              <Route path="screener" element={<Navigate to="/workspace" replace />} />
              <Route path="backtest" element={<Backtest />} />
              <Route path="orders" element={<Navigate to="/workspace" replace />} />
              <Route path="positions" element={<Navigate to="/workspace" replace />} />
              <Route path="strategy" element={<Strategy />} />
              <Route path="settings" element={<Navigate to="/strategy" replace />} />
              <Route path="*" element={<Navigate to="/workspace" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
