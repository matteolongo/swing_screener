import { TrendingUp, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import Button from '@/components/common/Button';
import StrategyCapitalRiskSummary from '@/components/domain/strategy/StrategyCapitalRiskSummary';
import {
  useActiveStrategyQuery,
  useSetActiveStrategyMutation,
  useStrategiesQuery,
} from '@/features/strategy/hooks';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Header({ isSidebarCollapsed = false, onToggleSidebar }: HeaderProps) {
  const now = new Date();
  const { locale, t } = useI18n();

  const strategiesQuery = useStrategiesQuery();
  const activeStrategyQuery = useActiveStrategyQuery();
  const setActiveMutation = useSetActiveStrategyMutation();
  const strategies = strategiesQuery.data ?? [];
  const activeId = activeStrategyQuery.data?.id ?? '';
  const isLoading = strategiesQuery.isLoading || activeStrategyQuery.isLoading;

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
    <header className="h-12 px-5 border-b border-border bg-white dark:bg-gray-800 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 shrink-0">
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
        <TrendingUp className="w-5 h-5 text-primary" />
        <h1 className="text-base font-bold leading-tight hidden sm:block">{t('header.brand')}</h1>
      </div>

      {/* Strategy selector — always accessible even when sidebar is collapsed */}
      <div className="flex-1 max-w-xs">
        <select
          value={activeId}
          onChange={(e) => {
            if (e.target.value && e.target.value !== activeId) {
              setActiveMutation.mutate(e.target.value);
            }
          }}
          aria-label={t('sidebar.activeStrategy')}
          className="w-full h-8 px-2 text-sm border border-border rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-primary focus:border-primary"
          disabled={isLoading || setActiveMutation.isPending}
        >
          {isLoading && <option value="">{t('sidebar.loadingStrategies')}</option>}
          {!isLoading && !strategies.length && <option value="">{t('sidebar.noStrategies')}</option>}
          {!isLoading && !activeId && <option value="">{t('sidebar.selectStrategy')}</option>}
          {!isLoading && strategies.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 shrink-0">
        <div className="hidden xl:block">
          <StrategyCapitalRiskSummary strategy={activeStrategyQuery.data} variant="compact" className="max-w-[38rem]" />
        </div>
        <span className="hidden md:block">{dateStr}</span>
        <span className="font-mono">{timeStr}</span>
      </div>
    </header>
  );
}
