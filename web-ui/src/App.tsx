import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Screener from './pages/Screener';
import Backtest from './pages/Backtest';
import Orders from './pages/Orders';
import Positions from './pages/Positions';
import Strategy from './pages/Strategy';
import Settings from './pages/Settings';

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
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
