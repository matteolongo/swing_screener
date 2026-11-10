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
    <div className="flex min-h-dvh bg-background">
      <a href="#main-content" className="sr-only z-40 rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {t('sidebar.skipToMain')}
      </a>
      {isDesktop ? <Sidebar className="sticky top-0 h-dvh w-52 shrink-0 self-start" /> : navigationOpen ? (
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
      <div className="min-w-0 flex-1">
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
        <main id="main-content" tabIndex={-1} className="min-w-0 bg-background px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
