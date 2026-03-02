import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { cn } from '@/utils/cn';
import { useOrders, usePositions } from '@/features/portfolio/hooks';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status: onboardingStatus } = useOnboardingStore();
  const ordersQuery = useOrders('all');
  const positionsQuery = usePositions('all');
  const isDecisionRoute = useMemo(
    () => location.pathname === '/daily-review' || location.pathname.startsWith('/daily-review/'),
    [location.pathname]
  );
  const isOnboardingRoute = useMemo(
    () => location.pathname === '/onboarding' || location.pathname.startsWith('/onboarding/'),
    [location.pathname]
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isDecisionRoute);

  useEffect(() => {
    setIsSidebarCollapsed(isDecisionRoute);
  }, [isDecisionRoute]);

  useEffect(() => {
    if (onboardingStatus !== 'new' || isOnboardingRoute) {
      return;
    }
    if (!ordersQuery.isFetched || !positionsQuery.isFetched) {
      return;
    }
    if (ordersQuery.isError || positionsQuery.isError) {
      return;
    }

    const hasNoOrders = (ordersQuery.data ?? []).length === 0;
    const hasNoPositions = (positionsQuery.data ?? []).length === 0;

    if (hasNoOrders && hasNoPositions) {
      navigate('/onboarding', { replace: true });
    }
  }, [
    isOnboardingRoute,
    navigate,
    onboardingStatus,
    ordersQuery.data,
    ordersQuery.isError,
    ordersQuery.isFetched,
    positionsQuery.data,
    positionsQuery.isError,
    positionsQuery.isFetched,
  ]);

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      <Header
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      />
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {!isSidebarCollapsed ? (
          <Sidebar
            className="w-64 shrink-0"
            onNavigate={() => {
              if (!isDecisionRoute) {
                setIsSidebarCollapsed(true);
              }
            }}
          />
        ) : null}
        <main
          className={cn(
            'flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900',
            isDecisionRoute ? 'p-3 sm:p-4 lg:p-5' : 'p-3 sm:p-4 md:p-6'
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
