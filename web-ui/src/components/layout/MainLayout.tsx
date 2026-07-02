import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import StatusBar from './StatusBar';
import Sidebar from './Sidebar';
import { cn } from '@/utils/cn';

export default function MainLayout() {
  const location = useLocation();
  const isWorkspaceRoute = useMemo(
    () => location.pathname === '/workspace' || location.pathname.startsWith('/workspace/'),
    [location.pathname]
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isWorkspaceRoute);

  useEffect(() => {
    setIsSidebarCollapsed(isWorkspaceRoute);
  }, [isWorkspaceRoute]);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <StatusBar
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isSidebarCollapsed ? <Sidebar className="w-56 shrink-0" /> : null}
        <main className={cn('flex-1 overflow-y-auto bg-background', isWorkspaceRoute ? 'p-5' : 'p-6')}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
