import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { cn } from '@/utils/cn';

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

function getDesktopViewportMatch() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

export default function MainLayout() {
  const location = useLocation();
  const isWorkspaceRoute = useMemo(
    () => location.pathname === '/workspace' || location.pathname.startsWith('/workspace/'),
    [location.pathname]
  );
  const [isDesktopViewport, setIsDesktopViewport] = useState(getDesktopViewportMatch);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(isWorkspaceRoute);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setIsDesktopSidebarCollapsed(isWorkspaceRoute);
    setIsMobileSidebarOpen(false);
  }, [isWorkspaceRoute]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (isDesktopViewport || !isMobileSidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktopViewport, isMobileSidebarOpen]);

  useEffect(() => {
    if (isDesktopViewport || !isMobileSidebarOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktopViewport, isMobileSidebarOpen]);

  const isSidebarCollapsed = isDesktopViewport ? isDesktopSidebarCollapsed : !isMobileSidebarOpen;

  const handleSidebarToggle = () => {
    if (isDesktopViewport) {
      setIsDesktopSidebarCollapsed((current) => !current);
      return;
    }
    setIsMobileSidebarOpen((current) => !current);
  };

  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

  return (
    <div className="min-h-dvh flex flex-col">
      <Header
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleSidebarToggle}
      />
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden',
            isMobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          aria-hidden
          onClick={closeMobileSidebar}
        />
        <Sidebar
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-200 lg:static lg:inset-auto lg:z-auto lg:max-w-none',
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            isDesktopSidebarCollapsed ? 'lg:hidden' : 'lg:w-64'
          )}
          onNavigate={closeMobileSidebar}
        />
        <main
          className={cn(
            'flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900',
            isWorkspaceRoute ? 'p-3 sm:p-4 lg:p-5' : 'p-3 sm:p-4 md:p-6'
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
