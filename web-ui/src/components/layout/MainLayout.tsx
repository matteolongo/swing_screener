import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { cn } from '@/utils/cn';

export default function MainLayout() {
  const location = useLocation();
  const isWorkspaceRoute = useMemo(
    () => location.pathname === '/workspace' || location.pathname.startsWith('/workspace/'),
    [location.pathname]
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    setIsSidebarCollapsed(isWorkspaceRoute);
  }, [isWorkspaceRoute]);

  return (
    <div className="h-screen flex flex-col">
      <Header
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      />
      <div className="flex-1 flex overflow-hidden">
        {!isSidebarCollapsed && <Sidebar />}
        <main
          className={cn(
            'flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900',
            isWorkspaceRoute ? 'p-4 md:p-5' : 'p-6'
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
