import { NavLink } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarDays,
  BookMarked,
  Database,
  Settings2,
  Activity,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

type NavigationItem = {
  href: string;
  icon: typeof CalendarCheck;
  labelKey: MessageKey;
};

const workspaceNav: NavigationItem[] = [
  { labelKey: 'sidebar.nav.today', href: '/today', icon: CalendarCheck },
  { labelKey: 'sidebar.nav.book', href: '/book', icon: BookMarked },
  { labelKey: 'sidebar.nav.universes', href: '/universes', icon: Database },
  { labelKey: 'sidebar.nav.calendar', href: '/calendar', icon: CalendarDays },
];

const toolNav: NavigationItem[] = [
  { labelKey: 'sidebar.nav.settings', href: '/strategy', icon: Settings2 },
  { labelKey: 'sidebar.nav.datasources', href: '/datasources', icon: Activity },
  { labelKey: 'header.gettingStarted', href: '/onboarding', icon: HelpCircle },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

function BrandMark({ size = 6 }: { size?: number }) {
  const px = size * 4;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
      style={{ width: px, height: px }}
    >
      <svg
        width={Math.round(px * 0.58)}
        height={Math.round(px * 0.58)}
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <polyline
          points="1,11 4.5,6.5 8,8.5 13,3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  const renderNavItem = (item: NavigationItem) => (
    <NavLink
      key={item.labelKey}
      to={item.href}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-transparent text-muted hover:bg-foreground/5 hover:text-foreground'
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t(item.labelKey)}
    </NavLink>
  );

  return (
    <aside className={cn('flex h-full min-h-0 flex-col border-r border-border bg-surface', className)}>
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-5">
        <BrandMark size={9} />
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-foreground">{t('header.brand')}</p>
          <p className="mt-0.5 text-xs text-muted">{t('sidebar.versionLabel')}</p>
        </div>
      </div>

      {/* Primary nav */}
      <nav
        id="primary-navigation"
        className="flex-1 space-y-6 overflow-y-auto px-3 py-5"
        aria-label={t('sidebar.navigation')}
      >
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{t('sidebar.nav.workspace')}</p>
          {workspaceNav.map(renderNavItem)}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{t('sidebar.nav.tools')}</p>
          {toolNav.map(renderNavItem)}
        </div>
      </nav>
    </aside>
  );
}
