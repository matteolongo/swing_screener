import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  BarChart3,
  FileText, 
  TrendingUp,
  SlidersHorizontal,
  Settings,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  useActiveStrategyQuery,
  useSetActiveStrategyMutation,
  useStrategiesQuery,
} from '@/features/strategy/hooks';
import { t } from '@/i18n/t';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';

const navigation = [
  { 
    labelKey: 'sidebar.nav.workspace', 
    href: '/workspace', 
    icon: LayoutDashboard,
    advanced: false, // Always enabled
  },
  { 
    labelKey: 'sidebar.nav.dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard,
    advanced: false, // Always enabled
  },
  { 
    labelKey: 'sidebar.nav.dailyReview', 
    href: '/daily-review', 
    icon: ClipboardCheck,
    advanced: false, // Always enabled
  },
  { 
    labelKey: 'sidebar.nav.screener', 
    href: '/screener', 
    icon: Search,
    advanced: false, // Always enabled
  },
  { 
    labelKey: 'sidebar.nav.backtest', 
    href: '/backtest', 
    icon: BarChart3,
    advanced: true, // Disabled in Beginner Mode
  },
  { 
    labelKey: 'sidebar.nav.orders', 
    href: '/orders', 
    icon: FileText,
    advanced: false, // Always enabled
  },
  { 
    labelKey: 'sidebar.nav.positions', 
    href: '/positions', 
    icon: TrendingUp,
    advanced: false, // Always enabled
  },
  { 
    labelKey: 'sidebar.nav.strategy', 
    href: '/strategy', 
    icon: SlidersHorizontal,
    advanced: false, // Always enabled
  },
  { 
    labelKey: 'sidebar.nav.settings', 
    href: '/settings', 
    icon: Settings,
    advanced: false, // Always enabled
  },
] as const;

export default function Sidebar() {
  const strategiesQuery = useStrategiesQuery();
  const activeStrategyQuery = useActiveStrategyQuery();
  const setActiveMutation = useSetActiveStrategyMutation();
  const { isBeginnerMode, toggleBeginnerMode } = useBeginnerModeStore();

  const activeId = activeStrategyQuery.data?.id ?? '';
  const strategies = strategiesQuery.data ?? [];
  const isLoading = strategiesQuery.isLoading || activeStrategyQuery.isLoading;
  const selectValue = activeId || '';

  const handleStrategyChange = (value: string) => {
    if (!value || value === activeId) return;
    setActiveMutation.mutate(value);
  };

  return (
    <aside className="w-64 border-r border-border bg-white dark:bg-gray-800 flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          {t('sidebar.activeStrategy')}
        </div>
        <select
          value={selectValue}
          onChange={(e) => handleStrategyChange(e.target.value)}
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
        {navigation.map((item) => {
          const isDisabled = isBeginnerMode && item.advanced;
          
          return (
            <div key={item.labelKey} className="relative group">
              <NavLink
                to={item.href}
                onClick={(e) => {
                  if (isDisabled) {
                    e.preventDefault();
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isDisabled
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {t(item.labelKey)}
              </NavLink>
              {isDisabled && (
                <div className="hidden group-hover:block absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50">
                  <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap">
                    {t('sidebar.disabledHint')}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('sidebar.mode.label')}
          </span>
          <button
            onClick={toggleBeginnerMode}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isBeginnerMode ? 'bg-gray-300' : 'bg-primary'
            )}
            aria-label={t('sidebar.mode.toggle')}
            title={t('sidebar.mode.toggle')}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                isBeginnerMode ? 'translate-x-1' : 'translate-x-6'
              )}
            />
          </button>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {isBeginnerMode ? t('sidebar.mode.beginner') : t('sidebar.mode.advanced')}
        </div>
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-gray-500">v0.1.0</p>
          <p className="mt-1 text-xs text-gray-500">{t('sidebar.versionLabel')}</p>
        </div>
      </div>
    </aside>
  );
}
