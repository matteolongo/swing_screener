import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { registerTradingStoreSync } from '@/features/persistence';
import { migrateRemovedUniverseIds } from '@/features/screener/universeStorage';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginGate } from '@/features/auth/LoginGate';

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

function TradingStoreSyncBridge() {
  const activeQueryClient = useQueryClient();
  useEffect(() => registerTradingStoreSync(activeQueryClient), [activeQueryClient]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoginGate>
          <TradingStoreSyncBridge />
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<div className="p-6 text-sm text-muted">Loading page...</div>}>
                <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<ErrorBoundary><Today /></ErrorBoundary>} />
                <Route path="calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
                <Route path="book" element={<ErrorBoundary><Book /></ErrorBoundary>} />
                <Route path="universes" element={<ErrorBoundary><Universes /></ErrorBoundary>} />
                <Route path="datasources" element={<ErrorBoundary><DataSources /></ErrorBoundary>} />
                <Route path="strategy" element={<ErrorBoundary><Strategy /></ErrorBoundary>} />
                <Route path="onboarding" element={<Onboarding />} />

                <Route path="*" element={<Navigate to="/today" replace />} />
              </Route>
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </LoginGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
