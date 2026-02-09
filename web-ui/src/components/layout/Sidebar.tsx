import { NavLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  LayoutDashboard, 
  Search, 
  BarChart3,
  FileText, 
  TrendingUp,
  SlidersHorizontal,
  Settings 
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { fetchActiveStrategy, fetchStrategies, setActiveStrategy } from '@/lib/strategyApi';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Screener', href: '/screener', icon: Search },
  { name: 'Backtest', href: '/backtest', icon: BarChart3 },
  { name: 'Orders', href: '/orders', icon: FileText },
  { name: 'Positions', href: '/positions', icon: TrendingUp },
  { name: 'Strategy', href: '/strategy', icon: SlidersHorizontal },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const queryClient = useQueryClient();

  const strategiesQuery = useQuery({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
  });

  const activeStrategyQuery = useQuery({
    queryKey: ['strategy-active'],
    queryFn: fetchActiveStrategy,
  });

  const setActiveMutation = useMutation({
    mutationFn: (strategyId: string) => setActiveStrategy(strategyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['strategy-active'] });
    },
  });

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
          Active Strategy
        </div>
        <select
          value={selectValue}
          onChange={(e) => handleStrategyChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={isLoading || setActiveMutation.isPending}
        >
          {isLoading && <option value="">Loading strategies…</option>}
          {!isLoading && !strategies.length && <option value="">No strategies</option>}
          {!isLoading && !activeId && <option value="">Select strategy</option>}
          {!isLoading &&
            strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
        </select>
        {activeStrategyQuery.data && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {activeStrategyQuery.data.isDefault ? 'Default strategy' : 'Custom strategy'}
          </div>
        )}
        {strategiesQuery.isError && (
          <div className="mt-2 text-xs text-red-600">Failed to load strategies</div>
        )}
        {setActiveMutation.isError && (
          <div className="mt-2 text-xs text-red-600">Failed to update active strategy</div>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
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
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border text-xs text-gray-500">
        <p>v0.1.0</p>
        <p className="mt-1">Risk-first swing trading</p>
      </div>
    </aside>
  );
}
