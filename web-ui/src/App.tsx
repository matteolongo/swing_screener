import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Workspace = lazy(() => import('./pages/Workspace'));
const DailyReview = lazy(() => import('./pages/DailyReview'));
const Screener = lazy(() => import('./pages/Screener'));
const Backtest = lazy(() => import('./pages/Backtest'));
const Orders = lazy(() => import('./pages/Orders'));
const Positions = lazy(() => import('./pages/Positions'));
const Strategy = lazy(() => import('./pages/Strategy'));
const Settings = lazy(() => import('./pages/Settings'));

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
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="workspace" element={<Workspace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="daily-review" element={<DailyReview />} />
              <Route path="screener" element={<Screener />} />
              <Route path="backtest" element={<Backtest />} />
              <Route path="orders" element={<Orders />} />
              <Route path="positions" element={<Positions />} />
              <Route path="strategy" element={<Strategy />} />
              <Route path="settings" element={<Settings />} />
              {/* More routes will be added later */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
