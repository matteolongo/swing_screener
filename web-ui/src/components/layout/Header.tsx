import { TrendingUp, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import Button from '@/components/common/Button';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Header({ isSidebarCollapsed = false, onToggleSidebar }: HeaderProps) {
  const now = new Date();
  const { locale, t } = useI18n();

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
    <header className="h-12 px-5 border-b border-border bg-white dark:bg-gray-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="gap-2 px-3"
            title={isSidebarCollapsed ? t('header.showNavigation') : t('header.hideNavigation')}
            aria-label={isSidebarCollapsed ? t('header.showNavigation') : t('header.hideNavigation')}
          >
            {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
        )}
        <TrendingUp className="w-8 h-8 text-primary" />
        <h1 className="text-xl font-bold leading-tight">{t('header.brand')}</h1>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>{dateStr}</span>
        <span className="font-mono">{timeStr}</span>
      </div>
    </header>
  );
}
