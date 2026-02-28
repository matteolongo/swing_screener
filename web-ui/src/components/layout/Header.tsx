import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BookOpen, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import UserModeToggle from '@/components/common/UserModeToggle';
import Button from '@/components/common/Button';
import { cn } from '@/utils/cn';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Header({ isSidebarCollapsed = false, onToggleSidebar }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const now = new Date();
  const { locale, t } = useI18n();
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
      <header
        className={cn(
          'border-b border-border bg-white dark:bg-gray-800 flex items-center justify-between',
          isWorkspaceRoute ? 'h-14 px-3 sm:px-4 md:px-5' : 'h-14 sm:h-16 px-3 sm:px-4 md:px-6'
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
              className="gap-2 px-2 sm:px-3"
              title={isSidebarCollapsed ? t('header.showNavigation') : t('header.hideNavigation')}
              aria-label={isSidebarCollapsed ? t('header.showNavigation') : t('header.hideNavigation')}
            >
              {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          )}
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          <h1 className={cn('font-bold leading-tight', isWorkspaceRoute ? 'text-lg sm:text-xl md:text-2xl' : 'text-lg sm:text-2xl')}>
            {t('header.brand')}
          </h1>
          {isWorkspaceRoute ? (
            <span className="hidden lg:inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
              {t('header.focusView')}
            </span>
          ) : null}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <UserModeToggle />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/onboarding')}
            className="gap-2"
            aria-label={t('header.gettingStarted')}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{t('header.gettingStarted')}</span>
          </Button>
          
          {!isWorkspaceRoute && (
            <div className="hidden lg:flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{dateStr}</span>
              <span className="font-mono">{timeStr}</span>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
