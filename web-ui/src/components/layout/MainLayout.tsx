import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import StatusBar from './StatusBar';
import Sidebar from './Sidebar';
import SymbolDrawer from '@/components/domain/symbol/SymbolDrawer';

export default function MainLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <StatusBar
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isSidebarCollapsed ? <Sidebar className="w-56 shrink-0" /> : null}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Outlet />
        </main>
      </div>
      <SymbolDrawer />
    </div>
  );
}
