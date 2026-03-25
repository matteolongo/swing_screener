import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  ClipboardCheck,
  LayoutDashboard,
  SlidersHorizontal,
} from 'lucide-react';

import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

type NavItem = {
  href: string;
  icon: typeof LayoutDashboard;
  labelKey: MessageKey;
};

const navItems: NavItem[] = [
  {
    labelKey: 'sidebar.nav.workspace',
    href: '/workspace',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'sidebar.nav.dailyReview',
    href: '/daily-review',
    icon: ClipboardCheck,
  },
  {
    labelKey: 'sidebar.nav.portfolio',
    href: '/portfolio',
    icon: Briefcase,
  },
  {
    labelKey: 'sidebar.nav.strategy',
    href: '/strategy',
    icon: SlidersHorizontal,
  },
  {
    labelKey: 'sidebar.nav.intelligence',
    href: '/intelligence',
    icon: Brain,
  },
  {
    labelKey: 'sidebar.nav.fundamentals',
    href: '/fundamentals',
    icon: BarChart3,
  },
  {
    labelKey: 'sidebar.nav.journal',
    href: '/journal',
    icon: BookOpen,
  },
];

export default function MobileBottomNav() {
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm lg:hidden"
    >
      <div className="mx-auto max-w-lg px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.45rem)]">
        <div className="grid grid-cols-7 gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="mt-1 leading-none">
                  {t(item.labelKey)}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
