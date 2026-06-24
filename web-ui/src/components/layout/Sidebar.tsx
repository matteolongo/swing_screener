import { NavLink } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarDays,
  BookMarked,
  Database,
  Settings2,
  Activity,
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
  { labelKey: 'sidebar.nav.today', href: '/today', icon: CalendarCheck },
  { labelKey: 'sidebar.nav.calendar', href: '/calendar', icon: CalendarDays },
  { labelKey: 'sidebar.nav.book', href: '/book', icon: BookMarked },
  { labelKey: 'sidebar.nav.universes', href: '/universes', icon: Database },
  { labelKey: 'sidebar.nav.datasources', href: '/datasources', icon: Activity },
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

function BrandMark({ size = 6 }: { size?: number }) {
  const px = size * 4;
  return (
    <div
      className="flex items-center justify-center rounded bg-primary shrink-0"
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
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside className={cn('h-full flex flex-col bg-surface border-r border-border', className)}>
      {/* Brand */}
      <div className="h-12 px-4 flex items-center gap-2.5 border-b border-border shrink-0">
        <BrandMark size={6} />
        <span className="text-[13px] font-semibold text-foreground tracking-tight leading-none">
          Swing Screener
        </span>
      </div>

      {/* Primary nav */}
      <nav
        className="flex-1 py-2 px-2 space-y-px overflow-y-auto"
        aria-label="Primary navigation"
      >
        {primaryNav.map((item) => (
          <NavLink
            key={item.labelKey}
            to={item.href}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-foreground/5 hover:text-foreground'
              )
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 pt-2 pb-3 shrink-0">
        <NavLink
          to={settingsNav.href}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-foreground/5 hover:text-foreground'
            )
          }
        >
          <settingsNav.icon className="w-4 h-4 shrink-0" />
          {t(settingsNav.labelKey)}
        </NavLink>
        <p className="text-[11px] text-muted/60 px-3 mt-1.5">
          {t('sidebar.versionLabel')}
        </p>
      </div>
    </aside>
  );
}
