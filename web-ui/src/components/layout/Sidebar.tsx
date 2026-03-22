import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  LayoutDashboard,
  SlidersHorizontal,
  ClipboardCheck,
  Brain,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  useActiveStrategyQuery,
  useSetActiveStrategyMutation,
  useStrategiesQuery,
} from '@/features/strategy/hooks';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

type NavigationItem = {
  href: string;
  icon: typeof LayoutDashboard;
  advanced: boolean;
  label?: string;
  labelKey?: MessageKey;
};

const navigation: NavigationItem[] = [
  { 
    labelKey: 'sidebar.nav.workspace', 
    href: '/workspace', 
    icon: LayoutDashboard,
    advanced: false, // Always enabled
  },
  {
    labelKey: 'sidebar.nav.dailyReview',
    href: '/daily-review',
    icon: ClipboardCheck,
    advanced: false,
  },
  {
    labelKey: 'sidebar.nav.portfolio',
    href: '/portfolio',
    icon: Briefcase,
    advanced: false,
  },
  { 
    labelKey: 'sidebar.nav.strategy', 
    href: '/strategy', 
    icon: SlidersHorizontal,
    advanced: false, // Always enabled
  },
  {
    labelKey: 'sidebar.nav.intelligence',
    href: '/intelligence',
    icon: Brain,
    advanced: false,
  },
  {
    labelKey: 'sidebar.nav.fundamentals',
    href: '/fundamentals',
    icon: BarChart3,
    advanced: false,
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  const strategiesQuery = useStrategiesQuery();
  const activeStrategyQuery = useActiveStrategyQuery();
  const setActiveMutation = useSetActiveStrategyMutation();
  const activeId = activeStrategyQuery.data?.id ?? '';
  const strategies = strategiesQuery.data ?? [];
  const isLoading = strategiesQuery.isLoading || activeStrategyQuery.isLoading;
  const selectValue = activeId || '';

  const handleStrategyChange = (value: string) => {
    if (!value || value === activeId) return;
    setActiveMutation.mutate(value);
  };

  return (
    <aside className={cn('h-full border-r border-border bg-white dark:bg-gray-800 flex flex-col', className)}>
      <div className="p-4 border-b border-border">
        <label
          htmlFor="sidebar-active-strategy-select"
          className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2"
        >
          {t('sidebar.activeStrategy')}
        </label>
        <select
          id="sidebar-active-strategy-select"
          value={selectValue}
          onChange={(e) => handleStrategyChange(e.target.value)}
          aria-label={t('sidebar.activeStrategy')}
          className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={isLoading || setActiveMutation.isPending}
        >
          {isLoading && <option value="">{t('sidebar.loadingStrategies')}</option>}
          {!isLoading && !strategies.length && <option value="">{t('sidebar.noStrategies')}</option>}
          {!isLoading && !activeId && <option value="">{t('sidebar.selectStrategy')}</option>}
          {!isLoading &&
            strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
        </select>
        {activeStrategyQuery.data && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {activeStrategyQuery.data.isDefault
              ? t('sidebar.defaultStrategy')
              : t('sidebar.customStrategy')}
          </div>
        )}
        {strategiesQuery.isError && (
          <div className="mt-2 text-xs text-red-600">{t('sidebar.loadError')}</div>
        )}
        {setActiveMutation.isError && (
          <div className="mt-2 text-xs text-red-600">{t('sidebar.updateError')}</div>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
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
            {item.labelKey ? t(item.labelKey) : item.label}
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
