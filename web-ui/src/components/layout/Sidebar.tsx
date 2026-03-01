import { NavLink } from 'react-router-dom';
import { BookOpen, ClipboardCheck, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';

const navigation = [
  {
    labelKey: 'sidebar.nav.decide',
    href: '/daily-review',
    icon: ClipboardCheck,
  },
  {
    labelKey: 'sidebar.nav.strategy',
    href: '/strategy',
    icon: SlidersHorizontal,
  },
  {
    labelKey: 'sidebar.nav.learn',
    href: '/onboarding',
    icon: BookOpen,
  },
] as const;

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside className={cn('h-full border-r border-border bg-white dark:bg-gray-800 flex flex-col', className)}>
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.labelKey}
            to={item.href}
            onClick={onNavigate}
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

      <div className="p-4 border-t border-border">
        <p className="text-xs text-gray-500">v0.1.0</p>
        <p className="mt-1 text-xs text-gray-500">{t('sidebar.versionLabel')}</p>
      </div>
    </aside>
  );
}
