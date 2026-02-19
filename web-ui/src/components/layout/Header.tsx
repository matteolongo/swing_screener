import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TrendingUp, BookOpen, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import UserModeToggle from '@/components/common/UserModeToggle';
import Button from '@/components/common/Button';
import GettingStartedModal from '@/components/modals/GettingStartedModal';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Header({ isSidebarCollapsed = false, onToggleSidebar }: HeaderProps) {
  const location = useLocation();
  const now = new Date();
  const { locale, t } = useI18n();
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const isWorkspaceRoute = location.pathname === '/workspace' || location.pathname.startsWith('/workspace/');
  
  const dateStr = now.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <header className="h-16 border-b border-border bg-white dark:bg-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {isWorkspaceRoute && onToggleSidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
              className="gap-2"
              title={isSidebarCollapsed ? 'Show navigation' : 'Hide navigation'}
            >
              {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          )}
          <TrendingUp className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">{t('header.brand')}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <UserModeToggle />
          {!isWorkspaceRoute && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowGettingStarted(true)}
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              {t('header.gettingStarted')}
            </Button>
          )}
          
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>{dateStr}</span>
            {!isWorkspaceRoute && <span className="font-mono">{timeStr}</span>}
          </div>
        </div>
      </header>
      {showGettingStarted && (
        <GettingStartedModal onClose={() => setShowGettingStarted(false)} />
      )}
    </>
  );
}
