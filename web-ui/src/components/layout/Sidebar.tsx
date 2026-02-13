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

const navigation = [
  { labelKey: 'sidebar.nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'sidebar.nav.dailyReview', href: '/daily-review', icon: ClipboardCheck },
  { labelKey: 'sidebar.nav.screener', href: '/screener', icon: Search },
  { labelKey: 'sidebar.nav.backtest', href: '/backtest', icon: BarChart3 },
  { labelKey: 'sidebar.nav.orders', href: '/orders', icon: FileText },
  { labelKey: 'sidebar.nav.positions', href: '/positions', icon: TrendingUp },
  { labelKey: 'sidebar.nav.strategy', href: '/strategy', icon: SlidersHorizontal },
  { labelKey: 'sidebar.nav.settings', href: '/settings', icon: Settings },
] as const;

export default function Sidebar() {
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
        {navigation.map((item) => (
          <NavLink
            key={item.labelKey}
            to={item.href}
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
      
      <div className="p-4 border-t border-border text-xs text-gray-500">
        <p>v0.1.0</p>
        <p className="mt-1">{t('sidebar.versionLabel')}</p>
      </div>
    </aside>
  );
}
