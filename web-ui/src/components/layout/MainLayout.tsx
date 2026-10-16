import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useOrders, usePositions } from '@/features/portfolio/hooks';
import { useOnboardingStore } from '@/stores/onboardingStore';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import { t } from '@/i18n/t';

export default function MainLayout() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? true);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1024px)');
    if (!media) return;
    const update = () => {
      setIsDesktop(media.matches);
      if (media.matches) closeNavigation();
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [closeNavigation]);

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
      <Header navigation={!isDesktop ? (
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('header.showNavigation')}
          aria-expanded={navigationOpen}
          aria-controls="primary-navigation"
          onClick={() => setNavigationOpen(true)}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : undefined} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {isDesktop ? <Sidebar className="w-56 shrink-0" /> : navigationOpen ? (
          <ModalShell
            title={t('sidebar.navigation')}
            onClose={closeNavigation}
            closeAriaLabel={t('header.hideNavigation')}
            fullScreen
            className="max-w-sm mr-auto"
            contentClassName="p-0"
          >
            <Sidebar onNavigate={closeNavigation} />
          </ModalShell>
        ) : null}
        <main className="flex-1 min-w-0 overflow-y-auto bg-background p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
