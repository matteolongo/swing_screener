import { useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useOrders, usePositions } from '@/features/portfolio/hooks';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status: onboardingStatus } = useOnboardingStore();
  const ordersQuery = useOrders('all');
  const positionsQuery = usePositions('all');
  const isOnboardingRoute = useMemo(
    () => location.pathname === '/onboarding' || location.pathname.startsWith('/onboarding/'),
    [location.pathname]
  );

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
    <div className="min-h-dvh flex flex-col bg-background">
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar className="w-56 shrink-0" />
        <main className="flex-1 min-w-0 overflow-y-auto bg-background p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
