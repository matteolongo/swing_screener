import { NavLink } from 'react-router-dom';
import {
  CalendarCheck,
  BookMarked,
  FlaskConical,
  Database,
  Settings2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

type NavigationItem = {
  href: string;
  icon: typeof CalendarCheck;
  labelKey: MessageKey;
};

const primaryNav: NavigationItem[] = [
  {
    labelKey: 'sidebar.nav.today',
    href: '/today',
    icon: CalendarCheck,
  },
  {
    labelKey: 'sidebar.nav.book',
    href: '/book',
    icon: BookMarked,
  },
  {
    labelKey: 'sidebar.nav.research',
    href: '/research',
    icon: FlaskConical,
  },
  {
    labelKey: 'sidebar.nav.universes',
    href: '/universes',
    icon: Database,
  },
];

const settingsNav: NavigationItem = {
  labelKey: 'sidebar.nav.settings',
  href: '/strategy',
  icon: Settings2,
};

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside className={cn('h-full border-r border-border bg-white dark:bg-gray-800 flex flex-col', className)}>
      <nav className="flex-1 p-4 space-y-1">
        {primaryNav.map((item) => (
          <NavLink
            key={item.labelKey}
            to={item.href}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        <NavLink
          to={settingsNav.href}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
            )
          }
        >
          <settingsNav.icon className="w-4 h-4" />
          {t(settingsNav.labelKey)}
        </NavLink>
        <p className="text-xs text-gray-400 dark:text-gray-500 px-4 pt-1">{t('sidebar.versionLabel')}</p>
      </div>
    </aside>
  );
}
